# Monitoring alerts

## Prometheus and Grafana

Prometheus evaluates the rules in `alert-rules.yml` every 15 seconds:

| Alert | Condition | Pending period |
|---|---|---|
| `CampusMarketplaceTargetDown` | The app's Prometheus scrape target is down | 1 minute |
| `CampusMarketplaceHighServerErrorCount` | More than five HTTP 5xx responses in a rolling five-minute window | 2 minutes |
| `CampusMarketplaceHighP95Latency` | Estimated p95 request duration is above one second | 5 minutes |

After deploying the Compose configuration, check `http://<host>:9090/alerts` for
rule state and `http://<host>:9090/targets` for scrape health. In Grafana, open
**Alerting → Alert rules** to view Prometheus data-source-managed rules, or
**Explore** and query `ALERTS` to graph active alert series.

These rules currently change alert state in Prometheus/Grafana only. No email,
Slack, or other notification contact point is configured.

## Kibana

Kibana requires a stable `KIBANA_ENCRYPTION_KEY` to enable alerting. Generate a
key once, store it in the local `.env` or deployment secret store, and keep the
same key across restarts and deployments:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

For local Compose, put the generated value in `.env`, then recreate Kibana:

```powershell
docker compose up -d --force-recreate kibana
```

For production, add it as the `KIBANA_ENCRYPTION_KEY` GitHub Actions secret or
provide `kibana_encryption_key` to the Ansible playbook, then redeploy. The
playbook writes the value to the host's protected `.env` file.

After Kibana restarts, open **Stack Management → Rules** and create an
**Elasticsearch query** rule:

1. Name it `Campus Marketplace application errors`.
2. Select `campus-marketplace-logs-*` as the index pattern.
3. Use a KQL query such as:

   ```text
   container.name: "campus_marketplace_app" and message: "*Operational error*"
   ```

4. Alert when the document count is greater than `3` during `5 minutes`.
5. Save it without an action connector to keep the alert visible in Kibana
   without sending email or Slack notifications.

The project ships Docker logs through Filebeat to Elasticsearch, so this Kibana
rule detects matching application log events. The existing Filebeat
configuration sends directly to Elasticsearch; it does not currently route
events through Logstash.

## Applying the configuration

Recreate the local monitoring services after updating the project files:

```powershell
docker compose up -d --force-recreate prometheus grafana kibana
```

Do not remove named volumes when applying the change; they hold the existing
database and monitoring data.
