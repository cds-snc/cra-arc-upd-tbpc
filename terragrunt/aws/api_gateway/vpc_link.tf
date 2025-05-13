resource "aws_apigatewayv2_vpc_link" "cra_upd_apigw_to_alb_vpclink" {
  security_group_ids = []
  subnet_ids         = var.vpc_private_subnet_ids
}