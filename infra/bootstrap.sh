#!/usr/bin/env bash
#
# One-time bootstrap. Run this once, from a machine signed in as a project
# owner; after it, every deploy happens from a GitHub push and nobody needs
# gcloud again.
#
#   ./infra/bootstrap.sh quantum-pulsar us-central1 teja1989/wallboard
#
# It creates only the four things that must exist *before* Terraform can run at
# all — Terraform owns everything else:
#
#   1. The APIs Terraform itself calls
#   2. A bucket to keep Terraform state in
#   3. A Workload Identity pool that trusts this one GitHub repository
#   4. A deploy service account that pool can impersonate
#
# No service-account key is created, downloaded, or pasted into GitHub. The
# workflow proves who it is with a short-lived GitHub OIDC token, so there is no
# long-lived credential to leak, rotate, or forget about.

set -euo pipefail

PROJECT_ID="${1:?usage: bootstrap.sh <project-id> <region> <github-owner/repo>}"
REGION="${2:?usage: bootstrap.sh <project-id> <region> <github-owner/repo>}"
GITHUB_REPO="${3:?usage: bootstrap.sh <project-id> <region> <github-owner/repo>}"

POOL_ID="github"
PROVIDER_ID="github-oidc"
DEPLOYER="marquee-deployer"
STATE_BUCKET="${PROJECT_ID}-marquee-tfstate"

echo "==> Project ${PROJECT_ID}, region ${REGION}, repo ${GITHUB_REPO}"
gcloud config set project "${PROJECT_ID}" >/dev/null

PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
echo "    project number ${PROJECT_NUMBER}"

# --- 1. APIs ---------------------------------------------------------------
# Terraform enables the application's own APIs. These are the ones it needs in
# order to be able to do that.
echo "==> Enabling bootstrap APIs (this takes a minute)"
gcloud services enable \
  cloudresourcemanager.googleapis.com \
  serviceusage.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  storage.googleapis.com \
  --project "${PROJECT_ID}"

# --- 2. Terraform state ----------------------------------------------------
# Versioned, so a bad apply can be rolled back to the previous state file, and
# private — state holds generated secrets.
if gcloud storage buckets describe "gs://${STATE_BUCKET}" >/dev/null 2>&1; then
  echo "==> State bucket gs://${STATE_BUCKET} already exists"
else
  echo "==> Creating state bucket gs://${STATE_BUCKET}"
  gcloud storage buckets create "gs://${STATE_BUCKET}" \
    --project "${PROJECT_ID}" \
    --location "${REGION}" \
    --uniform-bucket-level-access \
    --public-access-prevention
  gcloud storage buckets update "gs://${STATE_BUCKET}" --versioning
fi

# --- 3. Deploy identity ----------------------------------------------------
DEPLOYER_EMAIL="${DEPLOYER}@${PROJECT_ID}.iam.gserviceaccount.com"
if gcloud iam service-accounts describe "${DEPLOYER_EMAIL}" >/dev/null 2>&1; then
  echo "==> Deployer ${DEPLOYER_EMAIL} already exists"
else
  echo "==> Creating deployer service account"
  gcloud iam service-accounts create "${DEPLOYER}" \
    --project "${PROJECT_ID}" \
    --display-name "Marquee CI deployer"
fi

# Broad, because Terraform creates service accounts, IAM bindings, a Firebase
# project and Firestore indexes — and narrow custom roles for that would be a
# maintenance burden that buys little on a single-application project. The
# meaningful control is that only one GitHub repository, on one branch, can
# borrow this identity at all.
echo "==> Granting deploy roles"
for ROLE in \
  roles/owner \
  roles/firebase.admin \
  roles/iam.workloadIdentityPoolAdmin
do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member "serviceAccount:${DEPLOYER_EMAIL}" \
    --role "${ROLE}" \
    --condition None >/dev/null
done

gcloud storage buckets add-iam-policy-binding "gs://${STATE_BUCKET}" \
  --member "serviceAccount:${DEPLOYER_EMAIL}" \
  --role roles/storage.objectAdmin >/dev/null

# --- 4. Workload Identity Federation ---------------------------------------
if gcloud iam workload-identity-pools describe "${POOL_ID}" \
     --location global --project "${PROJECT_ID}" >/dev/null 2>&1; then
  echo "==> Workload identity pool '${POOL_ID}' already exists"
else
  echo "==> Creating workload identity pool"
  gcloud iam workload-identity-pools create "${POOL_ID}" \
    --project "${PROJECT_ID}" \
    --location global \
    --display-name "GitHub Actions"
fi

if gcloud iam workload-identity-pools providers describe "${PROVIDER_ID}" \
     --workload-identity-pool "${POOL_ID}" --location global \
     --project "${PROJECT_ID}" >/dev/null 2>&1; then
  echo "==> Provider '${PROVIDER_ID}' already exists"
else
  echo "==> Creating OIDC provider"
  # The attribute condition is the security boundary. Without it, *any* GitHub
  # repository in the world could mint a token this pool would accept.
  gcloud iam workload-identity-pools providers create-oidc "${PROVIDER_ID}" \
    --project "${PROJECT_ID}" \
    --location global \
    --workload-identity-pool "${POOL_ID}" \
    --display-name "GitHub OIDC" \
    --issuer-uri "https://token.actions.githubusercontent.com" \
    --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition "assertion.repository == '${GITHUB_REPO}'"
fi

POOL_NAME="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}"

echo "==> Letting ${GITHUB_REPO} impersonate the deployer"
gcloud iam service-accounts add-iam-policy-binding "${DEPLOYER_EMAIL}" \
  --project "${PROJECT_ID}" \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/${POOL_NAME}/attribute.repository/${GITHUB_REPO}" >/dev/null

PROVIDER_RESOURCE="${POOL_NAME}/providers/${PROVIDER_ID}"

cat <<SUMMARY

============================================================================
Bootstrap complete.

Add these as GitHub repository *variables* (Settings → Secrets and variables →
Actions → Variables). None of them is a secret — the provider only mints a token
for ${GITHUB_REPO}, so publishing them buys an attacker nothing.

  GCP_PROJECT_ID              ${PROJECT_ID}
  GCP_REGION                  ${REGION}
  GCP_WORKLOAD_IDENTITY_PROVIDER
                              ${PROVIDER_RESOURCE}
  GCP_DEPLOY_SERVICE_ACCOUNT  ${DEPLOYER_EMAIL}
  TF_STATE_BUCKET             ${STATE_BUCKET}
  OWNER_EMAILS                <your email, comma-separated for more>

Then push to the deploy branch and the workflow does the rest.

  gh variable set GCP_PROJECT_ID --body "${PROJECT_ID}"
  gh variable set GCP_REGION --body "${REGION}"
  gh variable set GCP_WORKLOAD_IDENTITY_PROVIDER --body "${PROVIDER_RESOURCE}"
  gh variable set GCP_DEPLOY_SERVICE_ACCOUNT --body "${DEPLOYER_EMAIL}"
  gh variable set TF_STATE_BUCKET --body "${STATE_BUCKET}"
  gh variable set OWNER_EMAILS --body "you@example.com"
============================================================================
SUMMARY
