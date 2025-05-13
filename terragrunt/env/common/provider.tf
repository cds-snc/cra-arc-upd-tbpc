terraform {
    required_providers {
      aws = {
        source  = "hashicorp/aws"
        version = "~> 5.39"
      }
    }
  }
  
  provider "aws" {
    region              = "ca-central-1" 
    allowed_account_ids = [ var.account_id ]

    default_tags {
      tags = {
        CostCentre  = var.billing_code
        Terraform   = true
        Environment = var.env
      }
    }
  }
  
  provider "aws" {
    alias               = "us-east-1"
    region              = "us-east-1"
    allowed_account_ids = [ var.account_id ]

    default_tags {
      tags = {
        CostCentre  = var.billing_code
        Terraform   = true
        Environment = var.env
      }
    }
  }