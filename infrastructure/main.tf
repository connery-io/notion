terraform {
  backend "s3" {}
}


module "deploy-plugin-on-aws-lambda" {
  source = "github.com/connery-io/deploy-plugin-on-aws-lambda?ref=v0.2.0"

  plugin_name    = "notion"
  plugin_version = "v1"
}