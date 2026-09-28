# Nightly encrypted dumps + off-server copies (DATA-07, DATA-08, DATA-10).
#
# Based on the same major version as the server so pg_dump always matches.
FROM postgres:17-alpine

RUN apk add --no-cache bash openssl rclone tzdata
ENV TZ=Europe/London

COPY backup.sh restore.sh entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/entrypoint.sh

VOLUME ["/backups"]
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
