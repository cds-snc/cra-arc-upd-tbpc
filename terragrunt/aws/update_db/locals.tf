locals {
  update_db_security_groups = [
    aws_security_group.cra_upd_ecs_update_db_sg.id,
    var.docdb_egress_sg_id
  ]
  scheduler_name = "${var.product_name}-update-db-scheduler"
  # removing the revision suffix
  task_definition_arn_unversioned = trimsuffix(module.update_db_ecs.task_definition_arn, ":${module.update_db_ecs.task_definition_revision}")
}
