resource "aws_apigatewayv2_vpc_link" "cra_upd_apigw_to_alb_vpclink" {
  name               = "${var.product_name}-apigw-to-alb-vpclink"
  security_group_ids = [aws_security_group.cra_upd_apigw_vpclink_sg.id]
  # Use a single subnet if instance count is 1, otherwise the VPC link won't be able to connect to the ALB.
  subnet_ids = var.ecs_instance_count > 1 ? var.vpc_private_subnet_ids : [var.vpc_private_subnet_ids[0]]
}

resource "aws_security_group" "cra_upd_apigw_vpclink_sg" {
  name        = "${var.product_name}-apigw-vpclink-sg"
  description = "Security Group for API Gateway VPC Link"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Allow ingress from the ECS load balancer to the API Gateway VPC Link"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [var.loadbalancer_sg_id]
  }

  egress {
    description     = "Allow egress to the ECS load balancer from the API Gateway VPC Link"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [var.loadbalancer_sg_id]
  }
}
