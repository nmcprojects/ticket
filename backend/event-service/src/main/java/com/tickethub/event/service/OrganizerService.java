package com.tickethub.event.service;

import com.tickethub.event.client.AuthClient;
import com.tickethub.event.domain.OrgPermission;
import com.tickethub.event.domain.OrganizerMember;
import com.tickethub.event.domain.OrganizerProfile;
import com.tickethub.event.domain.OrganizerRole;
import com.tickethub.event.dto.OrganizerDto;
import com.tickethub.event.dto.OrganizerMemberDto;
import com.tickethub.event.dto.OrganizerMemberRequest;
import com.tickethub.event.dto.OrganizerRequest;
import com.tickethub.event.dto.OrganizerRoleDto;
import com.tickethub.event.dto.OrganizerRoleRequest;
import com.tickethub.event.exception.NotFoundException;
import com.tickethub.event.repository.OrganizerMemberRepository;
import com.tickethub.event.repository.OrganizerRepository;
import com.tickethub.event.repository.OrganizerRoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static com.tickethub.event.dto.EventMapper.toDto;

@Service
@RequiredArgsConstructor
public class OrganizerService {

    private final OrganizerRepository repository;
    private final OrganizerMemberRepository memberRepository;
    private final OrganizerRoleRepository roleRepository;
    private final AuthClient authClient;

    @Transactional(readOnly = true)
    public List<OrganizerDto> findAll() {
        return repository.findAll().stream().map(com.tickethub.event.dto.EventMapper::toDto).toList();
    }

    @Transactional(readOnly = true)
    public OrganizerDto findById(Long id) {
        return toDto(get(id));
    }

    public OrganizerProfile get(Long id) {
        return repository.findById(id).orElseThrow(() -> NotFoundException.of("Organizer", id));
    }

    @Transactional
    public OrganizerDto create(OrganizerRequest req) {
        OrganizerProfile o = new OrganizerProfile();
        apply(o, req);
        return toDto(repository.save(o));
    }

    @Transactional
    public OrganizerDto update(Long id, OrganizerRequest req) {
        OrganizerProfile o = get(id);
        apply(o, req);
        return toDto(repository.save(o));
    }

    @Transactional
    public void delete(Long id) {
        if (!repository.existsById(id)) throw NotFoundException.of("Organizer", id);
        repository.deleteById(id);
    }

    // ── Self-service (the logged-in user's own organization) ────
    // GET /me runs the full setup (roles + owner) once, synchronously, BEFORE the
    // profile page fires its parallel roles/members reads — avoiding a setup race.
    @Transactional
    public OrganizerDto findOrCreateForUser(Long userId, String email) {
        return toDto(setupFor(userId, email));
    }

    @Transactional
    public OrganizerDto updateForUser(Long userId, String email, OrganizerRequest req) {
        OrganizerProfile o = getOrCreateEntity(userId, email);
        o.setOrganizationName(req.organizationName());
        o.setContactEmail(req.contactEmail() != null ? req.contactEmail() : email);
        o.setContactPhone(req.contactPhone());
        o.setDescription(req.description());
        o.setAvatarUrl(req.avatarUrl());
        return toDto(repository.save(o));
    }

    /** The logged-in user's organization id (auto-created if missing). Used when creating events. */
    @Transactional
    public Long resolveOrgIdForUser(Long userId, String email) {
        return getOrCreateEntity(userId, email).getId();
    }

    /** The user's existing organization id, or empty if they don't own one. Read-only — never creates. */
    @Transactional(readOnly = true)
    public java.util.Optional<Long> findOrgIdForUser(Long userId) {
        if (userId == null) return java.util.Optional.empty();
        return repository.findByAuthUserId(userId).map(OrganizerProfile::getId);
    }

    /**
     * Whether a user belongs to an organization — either as its owner (the profile's authUserId)
     * or as a team member. Used to gate per-event access (stats, buyer lists, check-in) so one
     * organization can't read another's data.
     */
    @Transactional(readOnly = true)
    public boolean userManagesOrg(Long userId, Long orgId) {
        if (userId == null || orgId == null) return false;
        boolean owner = repository.findByAuthUserId(userId).map(o -> orgId.equals(o.getId())).orElse(false);
        return owner || memberRepository.existsByOrganizerIdAndAuthUserId(orgId, userId);
    }

    /** All organization ids a user belongs to — the one they own plus any they're a member of. */
    @Transactional(readOnly = true)
    public Set<Long> orgIdsForUser(Long userId) {
        if (userId == null) return Set.of();
        Set<Long> ids = new LinkedHashSet<>();
        repository.findByAuthUserId(userId).ifPresent(o -> ids.add(o.getId()));
        memberRepository.findByAuthUserId(userId).forEach(m -> ids.add(m.getOrganizerId()));
        return ids;
    }

    private OrganizerProfile getOrCreateEntity(Long userId, String email) {
        return repository.findByAuthUserId(userId).orElseGet(() -> {
            OrganizerProfile n = new OrganizerProfile();
            n.setAuthUserId(userId);
            n.setOrganizationName(defaultName(email));
            n.setContactEmail(email);
            n.setVerified(false);
            return repository.save(n);
        });
    }

    /** Ensure the org exists AND has its default roles + an owner member. */
    private OrganizerProfile setupFor(Long userId, String email) {
        OrganizerProfile org = getOrCreateEntity(userId, email);
        Long orgId = org.getId();
        if (roleRepository.findByOrganizerIdOrderByIdAsc(orgId).isEmpty()) {
            roleRepository.saveAll(defaultRoles(orgId));
        }
        if (memberRepository.findByOrganizerIdOrderByIdAsc(orgId).isEmpty()) {
            Long ownerRoleId = roleRepository.findByOrganizerIdOrderByIdAsc(orgId).stream()
                    .filter(OrganizerRole::isSystemDefault).findFirst()
                    .map(OrganizerRole::getId).orElse(null);
            OrganizerMember owner = new OrganizerMember();
            owner.setOrganizerId(orgId);
            owner.setAuthUserId(userId);
            owner.setEmail(email);
            owner.setFullName(authClient.findByEmail(email).map(AuthClient.UserLookup::fullName).orElse(ownerName(email)));
            owner.setRoleId(ownerRoleId);
            memberRepository.save(owner);
        }
        return org;
    }

    private static List<OrganizerRole> defaultRoles(Long orgId) {
        List<OrganizerRole> roles = new ArrayList<>();
        roles.add(role(orgId, "Chủ tổ chức", true,
                Arrays.stream(OrgPermission.values()).map(Enum::name).collect(Collectors.toSet())));
        roles.add(role(orgId, "Quản lý", false, Set.of("EVENT_MANAGE", "ORDER_MANAGE", "STATS_VIEW")));
        roles.add(role(orgId, "Nhân viên check-in", false, Set.of("CHECKIN")));
        return roles;
    }

    private static OrganizerRole role(Long orgId, String name, boolean systemDefault, Set<String> perms) {
        OrganizerRole r = new OrganizerRole();
        r.setOrganizerId(orgId);
        r.setName(name);
        r.setSystemDefault(systemDefault);
        r.setPermissions(new HashSet<>(perms));
        return r;
    }

    // ── Roles: each org defines its own (a named set of permissions) ──
    @Transactional
    public List<OrganizerRoleDto> listRoles(Long userId, String email) {
        Long orgId = setupFor(userId, email).getId();
        return roleRepository.findByOrganizerIdOrderByIdAsc(orgId).stream().map(OrganizerService::toRoleDto).toList();
    }

    @Transactional
    public OrganizerRoleDto addRole(Long userId, String email, OrganizerRoleRequest req) {
        Long orgId = setupFor(userId, email).getId();
        return toRoleDto(roleRepository.save(role(orgId, req.name().trim(), false, validatePerms(req.permissions()))));
    }

    @Transactional
    public OrganizerRoleDto updateRole(Long userId, String email, Long roleId, OrganizerRoleRequest req) {
        OrganizerRole r = ownRole(userId, email, roleId);
        if (r.isSystemDefault()) throw new IllegalStateException("Không thể sửa vai trò mặc định (chủ tổ chức).");
        r.setName(req.name().trim());
        r.setPermissions(validatePerms(req.permissions()));
        return toRoleDto(roleRepository.save(r));
    }

    @Transactional
    public void deleteRole(Long userId, String email, Long roleId) {
        OrganizerRole r = ownRole(userId, email, roleId);
        if (r.isSystemDefault()) throw new IllegalStateException("Không thể xoá vai trò mặc định (chủ tổ chức).");
        if (memberRepository.countByRoleId(roleId) > 0) {
            throw new IllegalStateException("Vai trò đang được gán cho thành viên, không thể xoá.");
        }
        roleRepository.delete(r);
    }

    private OrganizerRole ownRole(Long userId, String email, Long roleId) {
        Long orgId = setupFor(userId, email).getId();
        return roleRepository.findById(roleId)
                .filter(x -> x.getOrganizerId().equals(orgId))
                .orElseThrow(() -> NotFoundException.of("Role", roleId));
    }

    private static Set<String> validatePerms(List<String> perms) {
        Set<String> out = new LinkedHashSet<>();
        if (perms != null) for (String p : perms) if (OrgPermission.isValid(p)) out.add(p);
        return out;
    }

    // ── Members: must be existing system users; assigned an org role ──
    @Transactional
    public List<OrganizerMemberDto> listMembers(Long userId, String email) {
        Long orgId = setupFor(userId, email).getId();
        Map<Long, String> roleNames = roleRepository.findByOrganizerIdOrderByIdAsc(orgId).stream()
                .collect(Collectors.toMap(OrganizerRole::getId, OrganizerRole::getName));
        return memberRepository.findByOrganizerIdOrderByIdAsc(orgId).stream()
                .map(m -> toMemberDto(m, roleNames)).toList();
    }

    @Transactional
    public OrganizerMemberDto addMember(Long userId, String email, OrganizerMemberRequest req) {
        Long orgId = setupFor(userId, email).getId();
        AuthClient.UserLookup u = authClient.findByEmail(req.email().trim())
                .orElseThrow(() -> new IllegalStateException("Email \"" + req.email() + "\" chưa có tài khoản trên hệ thống."));
        if (memberRepository.existsByOrganizerIdAndAuthUserId(orgId, u.id())) {
            throw new IllegalStateException("Người dùng này đã là thành viên của tổ chức.");
        }
        OrganizerRole role = roleRepository.findById(req.roleId())
                .filter(x -> x.getOrganizerId().equals(orgId))
                .orElseThrow(() -> NotFoundException.of("Role", req.roleId()));
        OrganizerMember m = new OrganizerMember();
        m.setOrganizerId(orgId);
        m.setAuthUserId(u.id());
        m.setEmail(u.email());
        m.setFullName(u.fullName());
        m.setRoleId(role.getId());
        return toMemberDto(memberRepository.save(m), Map.of(role.getId(), role.getName()));
    }

    @Transactional
    public OrganizerMemberDto updateMember(Long userId, String email, Long memberId, OrganizerMemberRequest req) {
        OrganizerMember m = ownMember(userId, email, memberId);
        OrganizerRole role = roleRepository.findById(req.roleId())
                .filter(x -> x.getOrganizerId().equals(m.getOrganizerId()))
                .orElseThrow(() -> NotFoundException.of("Role", req.roleId()));
        m.setRoleId(role.getId());
        return toMemberDto(memberRepository.save(m), Map.of(role.getId(), role.getName()));
    }

    @Transactional
    public void removeMember(Long userId, String email, Long memberId) {
        OrganizerMember m = ownMember(userId, email, memberId);
        roleRepository.findById(m.getRoleId()).ifPresent(r -> {
            if (r.isSystemDefault()) throw new IllegalStateException("Không thể xoá chủ tổ chức.");
        });
        memberRepository.delete(m);
    }

    private OrganizerMember ownMember(Long userId, String email, Long memberId) {
        Long orgId = setupFor(userId, email).getId();
        return memberRepository.findById(memberId)
                .filter(x -> x.getOrganizerId().equals(orgId))
                .orElseThrow(() -> NotFoundException.of("Member", memberId));
    }

    private static OrganizerMemberDto toMemberDto(OrganizerMember m, Map<Long, String> roleNames) {
        return new OrganizerMemberDto(m.getId(), m.getAuthUserId(), m.getEmail(), m.getFullName(),
                m.getRoleId(), roleNames.get(m.getRoleId()), m.getCreatedAt());
    }

    private static OrganizerRoleDto toRoleDto(OrganizerRole r) {
        return new OrganizerRoleDto(r.getId(), r.getName(),
                r.getPermissions().stream().sorted().toList(), r.isSystemDefault(), r.getCreatedAt());
    }

    private static String ownerName(String email) {
        if (email == null || email.isBlank()) return "Chủ tổ chức";
        return email.contains("@") ? email.substring(0, email.indexOf('@')) : email;
    }

    private static String defaultName(String email) {
        if (email == null || email.isBlank()) return "Tổ chức của tôi";
        String local = email.contains("@") ? email.substring(0, email.indexOf('@')) : email;
        return "Tổ chức " + local;
    }

    private void apply(OrganizerProfile o, OrganizerRequest req) {
        o.setAuthUserId(req.authUserId());
        o.setOrganizationName(req.organizationName());
        o.setContactEmail(req.contactEmail());
        o.setContactPhone(req.contactPhone());
        o.setDescription(req.description());
        o.setAvatarUrl(req.avatarUrl());
        if (req.verified() != null) o.setVerified(req.verified());
    }
}
