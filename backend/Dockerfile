FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal
RUN CGO_ENABLED=0 go build -trimpath -o /server ./cmd/server

FROM alpine:3.23
RUN apk add --no-cache ca-certificates && addgroup -g 10001 app && adduser -D -u 10001 -G app app
WORKDIR /app
COPY --from=build /server /app/server
COPY data /app/data
RUN mkdir -p /app/var && chown -R app:app /app/var
USER app
ENV LISTEN_ADDR=0.0.0.0:8080 STATE_PATH=/app/var/state.json
EXPOSE 8080
ENTRYPOINT ["/app/server"]
