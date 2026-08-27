# ---------------------------------------------------------------------------
# Firebase and Identity Platform.
#
# The app authenticates people with Firebase Auth, so the project has to be a
# Firebase project and there has to be a registered web app to read the client
# config from. Doing that here rather than in the console means the values that
# get baked into the browser bundle come from the same place as everything else.
# ---------------------------------------------------------------------------

resource "google_firebase_project" "this" {
  provider = google-beta
  project  = var.project_id

  depends_on = [google_project_service.this]
}

resource "google_firebase_web_app" "this" {
  provider     = google-beta
  project      = var.project_id
  display_name = "Marquee"

  # Destroying the web app would invalidate the API key baked into every
  # deployed bundle, so it is deleted rather than abandoned only on purpose.
  deletion_policy = "DELETE"

  depends_on = [google_firebase_project.this]
}

data "google_firebase_web_app_config" "this" {
  provider   = google-beta
  project    = var.project_id
  web_app_id = google_firebase_web_app.this.app_id
}

/**
 * Sign-in methods.
 *
 * Email link only. Google sign-in needs an OAuth client and a reviewed consent
 * screen, neither of which has a sane Terraform representation — `var.google_sign_in`
 * exists so the button appears once that is done by hand.
 */
resource "google_identity_platform_config" "auth" {
  provider = google-beta
  project  = var.project_id

  sign_in {
    allow_duplicate_emails = false

    email {
      enabled = true
      # The whole point is the emailed link; a password would be a second
      # credential to store, leak and reset.
      password_required = false
    }

    /**
     * Guests.
     *
     * Not an afterthought — it is how everybody who is *not* the host uses the product.
     * A visitor arriving from a shared code is signed in anonymously so their Firestore
     * listener has an identity to authorize, and so that redeeming a code is one tap with
     * no account. Describing sign-in methods here at all turns off whatever is not listed,
     * so leaving this out disabled it: every guest hit `auth/admin-restricted-operation`
     * and could not open an invitation at all.
     */
    anonymous {
      enabled = true
    }
  }

  # Redirect targets Firebase will honour for the sign-in link. Anything not
  # listed here cannot complete a sign-in, which is what stops a link being
  # replayed against an attacker's page.
  # The run.app host stays listed even once a custom domain is the canonical one. DNS takes
  # time to propagate and certificates take longer, and during that window the service's own
  # URL is the only one that answers — dropping it would break sign-in on the exact address
  # someone falls back to when the new domain is not live yet.
  authorized_domains = distinct(compact([
    "localhost",
    "${var.project_id}.firebaseapp.com",
    "${var.project_id}.web.app",
    replace(replace(local.predicted_url, "https://", ""), "http://", ""),
    replace(replace(local.site_url, "https://", ""), "http://", ""),
  ]))

  depends_on = [
    google_firebase_project.this,
    google_project_service.this,
  ]
}

/**
 * Google as a sign-in provider.
 *
 * Only created once a client exists. Google sign-in is one tap where the email link is a
 * round trip through an inbox, so it is the single biggest conversion difference available
 * on the way in — and it removes email deliverability from the critical path of somebody
 * simply trying to sign in.
 */
resource "google_identity_platform_default_supported_idp_config" "google" {
  count = var.google_oauth_client_id != "" ? 1 : 0

  provider      = google-beta
  project       = var.project_id
  enabled       = true
  idp_id        = "google.com"
  client_id     = var.google_oauth_client_id
  client_secret = var.google_oauth_client_secret

  depends_on = [google_identity_platform_config.auth]
}

# Fail at plan time rather than shipping a button nobody can use.
#
# The condition has to reference something — Terraform rejects a constant, on the grounds
# that a check which cannot vary is not checking anything. So the guard exists only when
# the flag is on, and asserts the client is present.
resource "terraform_data" "google_sign_in_guard" {
  count = var.google_sign_in ? 1 : 0

  lifecycle {
    precondition {
      condition     = var.google_oauth_client_id != ""
      error_message = "google_sign_in is true but google_oauth_client_id is empty. Set GOOGLE_OAUTH_CLIENT_ID and the GOOGLE_OAUTH_CLIENT_SECRET secret, or leave GOOGLE_SIGN_IN false."
    }
  }
}
