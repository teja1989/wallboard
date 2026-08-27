output "service_url" {
  description = "The URL Cloud Run actually assigned the service."
  value       = google_cloud_run_v2_service.app.uri
}

output "site_url" {
  description = <<-EOT
    The origin the app is configured with — what gets baked into the bundle, and
    what the bucket's CORS policy allows. Equal to service_url unless a custom
    domain is set, and the deploy workflow reconciles the two.
  EOT
  value       = local.site_url
}

output "media_bucket" {
  description = "Private bucket holding uploaded media."
  value       = google_storage_bucket.media.name
}

output "artifact_repository" {
  description = "Docker repository path CI pushes images to."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app.repository_id}"
}

output "runtime_service_account" {
  description = "Identity the service runs as."
  value       = google_service_account.run.email
}

# Public by definition — Next inlines these into the browser bundle. They are
# outputs so CI can pass them to `docker build` without anyone copying them out
# of a console.
output "firebase_web_config" {
  description = "NEXT_PUBLIC_* values the image is built with."
  value = {
    api_key        = data.google_firebase_web_app_config.this.api_key
    auth_domain    = data.google_firebase_web_app_config.this.auth_domain
    project_id     = var.project_id
    storage_bucket = google_storage_bucket.media.name
    app_id         = google_firebase_web_app.this.app_id
    google_sign_in = var.google_sign_in
  }
}

/**
 * What to put in DNS, straight from the mapping.
 *
 * Printed in the deploy summary so nobody has to go and ask gcloud for them — the records
 * are the one manual step left in getting a domain live, and the gap between "Terraform
 * says done" and "the site answers" is entirely this list.
 */
output "domain_dns_records" {
  description = "Records to add at the registrar. Empty until a custom domain is configured."
  value = try(
    [
      for record in google_cloud_run_domain_mapping.custom[0].status[0].resource_records :
      "${record.type}  ${coalesce(record.name, "@")}  ${record.rrdata}"
    ],
    [],
  )
}
