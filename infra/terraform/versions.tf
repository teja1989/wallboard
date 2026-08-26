terraform {
  required_version = ">= 1.9"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.20"
    }
    # Firebase resources (project registration, web app, storage bucket
    # registration) are beta-only in the provider. Identity Platform is not,
    # but keeping one alias for all Firebase-shaped resources is clearer.
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 6.20"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Filled in by `terraform init -backend-config=...` from the bootstrap
  # output, so the bucket name is not hard-coded into the repo.
  backend "gcs" {
    prefix = "marquee"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}
