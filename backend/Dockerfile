# Shared multi-stage build for every Spring service.
# Pass the module name via build arg MODULE (e.g. event-service).
# Build context must be the backend/ root.
#   docker build --build-arg MODULE=event-service -t event-service .
FROM maven:3.9-eclipse-temurin-17 AS build
ARG MODULE
WORKDIR /workspace
COPY . .
# BuildKit cache mount shares the Maven repo across service builds (much faster).
# maven.test.skip skips BOTH compiling and running tests — production images
# don't need test sources (and avoids pulling Testcontainers deps into the image build).
RUN --mount=type=cache,target=/root/.m2 \
    mvn -q -Dmaven.test.skip=true -pl ${MODULE} -am package && \
    cp ${MODULE}/target/*.jar /app.jar

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
