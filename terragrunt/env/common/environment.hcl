inputs = {
  secrets = {
    for val in [
      "AA_CREDS_POOL",
      "AIRTABLE_TOKEN",
      "AW_CLIENT_ID",
      "AW_CLIENT_SECRET",
      "AW_ORGANIZATION_ID",
      "AW_TECHNICAL_ID",
      "AW_COMPANY_ID",
      "AW_REPORTSUITE_ID",
      "DOCDB_USERNAME",
      "DOCDB_PASSWORD",
      "FEEDBACK_API_HOST",
      "FEEDBACK_API_USERNAME",
      "FEEDBACK_API_PASSWORD",
      "GSC_EMAIL",
      "GSC_KEY",
      "NOTIFY_API_KEY",
      "NOTIFY_EMAIL",
      "NOTIFY_EMAIL_2",
    ] : val => get_env(val)
  }

  env = [
    for val in [
      "AIRTABLE_BASE_ANNOTATIONS",
      "AIRTABLE_BASE_GCTASKSMAPPINGS",
      "AIRTABLE_BASE_TASKS_INVENTORY",
      "AIRTABLE_BASE_FEEDBACK",
      "AIRTABLE_BASE_LIVE_FEEDBACK",
      "AIRTABLE_BASE_PAGES",
      "AIRTABLE_BASE_SEARCH_ASSESSMENT",
      "AIRTABLE_BASE_DCD_2021_Q1",
      "AIRTABLE_BASE_DCD_2021_Q2",
      "AIRTABLE_BASE_DCD_2021_Q3",
      "AIRTABLE_BASE_DCD_2021_Q4",
      "AIRTABLE_BASE_DCD_2022_Q1",
      "AIRTABLE_BASE_DCD_2022_Q2",
      "AIRTABLE_BASE_DCD_2022_Q3",
      "AIRTABLE_BASE_DCD_2022_Q4",
      "AIRTABLE_BASE_DCD_2023_Q1",
      "AIRTABLE_BASE_DCD_2023_Q2",
      "AIRTABLE_BASE_DCD_2023_Q3",
      "AIRTABLE_BASE_DCD_2023_Q4",
      "AIRTABLE_BASE_DCD_2024_Q1",
      "AIRTABLE_BASE_DCD_2024_Q2",
      "AIRTABLE_BASE_DCD_2024_Q3",
      "AIRTABLE_BASE_DCD_2024_Q4",
      "AIRTABLE_BASE_DCD_2025_Q1",
      "AIRTABLE_BASE_DCD_2025_Q2",
      "AIRTABLE_BASE_DCD_2025_Q3",
      "AIRTABLE_BASE_DCD_2025_Q4",
      "NOTIFY_TEMPLATE_ID_EN",
      "NOTIFY_TEMPLATE_ID_FR",
      "STORAGE_URI_PREFIX",
      ] : {
      name : val,
      value : get_env(val)
    }
  ]
}