resource "aws_apigatewayv2_api" "cra_upd_apigw_endpoint" {
  name                         = "${var.product_name_dashed}-apigw"
  protocol_type                = "HTTP"
  disable_execute_api_endpoint = true # Only allow access to the API Gateway through CloudFront
}

# Create the API Gateway HTTP_PROXY integration between the created API and the private load balancer via the VPC Link.
resource "aws_apigatewayv2_integration" "cra_upd_apigw_integration" {
  api_id           = aws_apigatewayv2_api.cra_upd_apigw_endpoint.id
  integration_type = "HTTP_PROXY"
  integration_uri  = var.loadbalancer_arn

  integration_method     = "ANY"
  connection_type        = "VPC_LINK"
  connection_id          = aws_apigatewayv2_vpc_link.cra_upd_apigw_to_alb_vpclink.id
  payload_format_version = "1.0"
}

resource "aws_apigatewayv2_route" "cra_upd_apigw_route" {
  api_id    = aws_apigatewayv2_api.cra_upd_apigw_endpoint.id
  route_key = "ANY /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.cra_upd_apigw_integration.id}"
}

resource "aws_apigatewayv2_stage" "cra_upd_apigw_stage" {
  api_id      = aws_apigatewayv2_api.cra_upd_apigw_endpoint.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 100
    throttling_rate_limit  = 1000
  }
}