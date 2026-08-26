---
name: marquee-deploy
description: Deploy Marquee to Google Cloud, or change its infrastructure. Use when touching infra/terraform, the Dockerfile, the deploy workflow, environment variables that reach Cloud Run, or when a deploy fails and needs diagnosing.
---

# Deploying Marquee

Full narrative in [docs/DEPLOYMENT.md](../../../docs/DEPLOYMENT.md). This is the operating
detail.

Project `quantum-pulsar`, region `us-central1`, deployed by pushing to
`claude/group-event-wallboard-gcp-aqi0q3` or `main`.

## The shape

```
infra/bootstrap.sh          run once, by a human, with gcloud
infra/terraform/*.tf        everything else
.github/workflows/deploy.yml  verify → apply → build → apply → smoke
Dockerfile                  three stages; only NEXT_PUBLIC_* are build args
```

## Verifying a change before pushing

```bash
cd infra/terraform
terraform fmt -recursive        # the workflow fails on -check, so run this first
terraform validate
```

For anything structural, use the workflow's **plan only** dispatch rather than guessing.
It runs validate and plan against real state and deploys nothing.

## The rules that are easy to break

- **Never read `google_cloud_run_v2_service.app.uri` in `local.site_url`.** The service's own
  env and the bucket CORS both consume that origin, so it would depend on itself and
  Terraform refuses the graph. It is derived from the project number instead, and the
  workflow reconciles it. This has already been broken once.
- **`NEXT_PUBLIC_*` is baked in at build time.** Adding one means adding it in four places:
  `env.config.ts`, the `Dockerfile` ARG/ENV pair, the `docker build` args in the workflow,
  and the Cloud Run `env` block. Miss the Dockerfile and the browser gets `undefined`.
- **Secrets are never build args.** They would be readable in an image layer forever. They
  come from Secret Manager at start-up, through `value_source.secret_key_ref`.
- **`terraform fmt -check` runs before the generated tfvars is written.** If you move the
  "Assemble Terraform variables" step earlier, `fmt -check` will fail on a generated file.
- **`random_password` resources carry `ignore_changes = all`.** Removing that would rotate
  `JOIN_CODE_PEPPER` on the next apply and invalidate every outstanding join code.
- **An Artifact Registry KEEP policy deletes nothing on its own.** It only protects images
  from a DELETE policy. Both are needed.
- **The runtime service account must be a token creator _for itself_.** Cloud Run has no key
  file, so the Storage SDK signs V4 URLs through IAM. Without it every upload and every
  photo fails, and the error names nothing useful.

## Changing what runs

| Want                     | Change                                                                   |
| ------------------------ | ------------------------------------------------------------------------ |
| A custom domain          | Map it in Cloud Run, set the `SITE_URL` repository variable              |
| Real email               | `RESEND_API_KEY` into Secret Manager, `email_driver = "resend"`          |
| Real payments            | Four Stripe secrets, `billing_driver = "stripe"`, `FEATURE_BILLING=true` |
| Google sign-in           | OAuth client + consent screen, then `GOOGLE_SIGN_IN=true`                |
| A different cost ceiling | `max_instances` in `variables.tf`                                        |
| Budget alerts            | `GCP_BILLING_ACCOUNT` and `BUDGET_ALERT_EMAILS` variables                |

## When a deploy fails

1. **Which step?** `verify` is a code problem — reproduce locally. Anything after is infra.
2. **`terraform apply` failed** — read the error, not the summary. API-not-enabled and
   Identity-Platform-still-initialising are both fixed by re-running.
3. **`smoke` failed** — Terraform succeeded and the app did not. Cloud Run keeps the previous
   revision serving unless the new one became ready, so the site is probably still up. Read
   the revision logs in the console; a boot failure is almost always a missing env var, and
   `serverEnv()` names it.
4. **Never fix it by clicking in the console.** The next apply reverts it. Fix the Terraform.
