# 
# Application Load Balancer for ECS
#

resource "aws_lb" "cra_upd_ecs_alb" {
  load_balancer_type = "application"
  internal           = true
  idle_timeout       = 300
  subnets            = var.vpc_private_subnet_ids
  security_groups    = [aws_security_group.cra_upd_loadbalancer_sg.id]
}

resource "aws_lb_target_group" "cra_upd_ecs_lb_target_group" {
  port                              = 9000
  protocol                          = "HTTP"
  target_type                       = "ip"
  vpc_id                            = var.vpc_id
  load_balancing_cross_zone_enabled = false

  deregistration_delay = 30

  health_check {
    path                = "/api/_healthcheck"
    port                = "traffic-port"
    interval            = 60
    timeout             = 15
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }

  target_group_health {
    dns_failover {
      minimum_healthy_targets_count      = 1
      minimum_healthy_targets_percentage = 1
    }
  }
}

resource "aws_lb_listener" "cra_upd_ecs_alb_listener" {
  load_balancer_arn = aws_lb.cra_upd_ecs_alb.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.cra_upd_ecs_lb_target_group.arn
  }
}
