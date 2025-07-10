import os
import time
import pandas as pd
import json
from airtable import Airtable
import numpy as np
from dotenv import load_dotenv
from datetime import datetime
import re
from datetime import datetime

def find_latest_file(prefix, patterns):
    latest_date = None
    latest_file = None
    for filename in os.listdir("source"):
        for pattern, fmt in patterns:
            match = re.match(pattern, filename)
            if match and match.group(1) == prefix:
                if fmt == "mdy":
                    _, mm, dd, yyyy = match.groups()
                else:
                    _, yyyy, mm, dd = match.groups()
                try:
                    file_date = datetime(int(yyyy), int(mm), int(dd))
                    if not latest_date or file_date > latest_date:
                        latest_date = file_date
                        latest_file = filename
                except ValueError:
                    continue
    return os.path.join("source", latest_file) if latest_file else None

def main():
    load_dotenv()

    start_time = datetime.now() 
    # Set the Airtable credentials and table names
    base_id = os.getenv("AIRTABLE_BASE_PAGES", "")
    current_table_name = os.getenv("CURRENT_TABLE_NAME", "Published CRA pages")

    api_key= os.getenv("AIRTABLE_TOKEN", "")

    patterns = [
        (r"(fug-data)-(\d{2})-(\d{2})-(\d{4})\.txt", "mdy"),
        (r"(gcPageReport)-publish-(\d{2})-(\d{2})-(\d{4})\.csv", "mdy"),
        (r"(sections_data)_(\d{4})_(\d{2})_(\d{2})\.csv", "ymd"),
    ]

    file_path = find_latest_file("fug-data", patterns)
    aemDatapath = find_latest_file("gcPageReport", patterns)
    sections_data_path = find_latest_file("sections_data", patterns)

    print(f"Using FUG file: {file_path}")
    print(f"Using AEM file: {aemDatapath}")
    print(f"Using ABSB file: {sections_data_path}")

    # #-------------------LOAD AND PROCESS the CURRENT PAGES DATA from AIRTABLE-------------
    # #-------------------------------------------------------------------------------------
    # try:
    # Connect to Airtable
    airtable_current = Airtable(base_id, current_table_name, api_key)

    # Load sections data
    sections_df = pd.read_csv(sections_data_path, dtype=str, encoding='utf-8')
    print("Successfully loaded sections data from CSV")

    # Fetch the current data
    current_records = []
    for page in airtable_current.get_iter():
        current_records.extend(page)
        time.sleep(0.2)  # For the rate limit of 5 requests per second

    # Convert records to dataframe and include the record_id
    data_list = []
    for record in current_records:
        row_data = record['fields']
        row_data['record_id'] = record['id']
        data_list.append(row_data)

    current_df = pd.DataFrame(data_list)

    # #-------------------LOAD AND PROCESS the FUG DATA-------------------------------------
    # #-------------------------------------------------------------------------------------

    if file_path.endswith('.json'):
        with open(file_path, 'r') as file:
            data = json.load(file)['data']
    elif file_path.endswith('.txt'):
        with open(file_path, 'r') as file:
            data = json.loads(file.read())['data']

    print("Successfully uploaded/read the FUG data")

    # Process the FUG data
    processed_data = []

    for item in data:
        group_responsible = [group.strip() for group in item[-1].split(';')]
        # Extract only fields starting with "http://" or "https://"
        urls = [field for field in item[:-1] if field.startswith(('http://', 'https://', '/'))]

        for url in urls:
            processed_data.append([url.strip(), group_responsible])

    # Convert to dataframe
    additional_df = pd.DataFrame(processed_data, columns=['Page path', 'Group responsible'])

    print("Successfully created the FUG dataframe")

    # Check for duplicates in the Url column
    duplicates = additional_df[additional_df.duplicated('Page path')]
    if not duplicates.empty:
        print("Warning: Found duplicate URLs in the FUG data!")

        # Here, we're dropping the duplicates for simplicity, but you can choose how to handle them
        additional_df.drop_duplicates('Page path', inplace=True)
        print("Success: Duplicate URLs removed from the FUG data!")

    # #-------------------UPDATE Section fields IF UPDATED IN THE FUG DATA-----------------
    # #-----------------------------------------------------------------------------------

    # Prepare sections_df by combining URLs into a single column
    sections_df['Unified URL'] = sections_df.apply(lambda row: [row['URL (english)'], row['URL (french)']], axis=1)
    sections_df = sections_df.explode('Unified URL')
    sections_df = sections_df[['Unified URL', 'Section']]

    # Check for duplicates in the Url column
    duplicates_section = sections_df[sections_df.duplicated('Unified URL')]
    if not duplicates_section.empty:
        print("Warning: Found duplicate URLs in the Sections data!")

        # Here, we're dropping the duplicates for simplicity, but you can choose how to handle them
        sections_df.drop_duplicates('Unified URL', inplace=True)
        print("Success: Duplicate URLs removed from the Sections data!")

    # Merge current_df with sections_df
    merged_df = current_df.merge(sections_df, left_on='Page path', right_on='Unified URL', how='left', suffixes=('', '_update'))
    merged_df.drop('Unified URL', axis=1, inplace=True)  # Drop the 'Unified URL' after merging

    # Handle possible nulls
    merged_df.fillna('', inplace=True)

    if 'Section' in current_df.columns:
        # Determine which rows need updating based on differences in 'Section'
        section_condition = (merged_df['Section'] != merged_df['Section_update']) & (merged_df['Section_update'] != '')
        updated_section_count = section_condition.sum()

        # If updates are needed for 'Section', apply them
        if updated_section_count > 0:
            update_section_data = [
                {"id": row['record_id'], "fields": {"Section": row['Section_update']}}
                for _, row in merged_df[section_condition].iterrows()
            ]
            airtable_current.batch_update(update_section_data)
            merged_df.loc[section_condition, 'Section'] = merged_df.loc[section_condition, 'Section_update']
    else:
        update_data = []

        section_condition = (merged_df['Section'] != '')
        updated_section_count = section_condition.sum()

        if updated_section_count > 0:
            update_section_data = [
                {"id": row['record_id'], "fields": {"Section": row['Section']}}
                for _, row in merged_df[section_condition].iterrows()
            ]
            airtable_current.batch_update(update_section_data)

    # Merge the additional_df to update 'Group responsible'
    merged_df = merged_df.merge(additional_df[['Page path', 'Group responsible']], on='Page path', how='left', suffixes=('', '_update'))

    # Convert 'Group responsible' fields from list to string if necessary
    merged_df['Group responsible'] = merged_df['Group responsible'].apply(lambda x: ', '.join(x) if isinstance(x, list) else x)
    merged_df['Group responsible_update'] = merged_df['Group responsible_update'].apply(lambda x: ', '.join(x) if isinstance(x, list) else x)

    merged_df.fillna('', inplace=True)

    if 'Group responsible' in current_df.columns:
        # Determine which rows need updating based on differences in 'Group responsible'
        group_condition = (merged_df['Group responsible'] != merged_df['Group responsible_update']) & (merged_df['Group responsible_update'] != '')
        updated_group_count = group_condition.sum()

        # If updates are needed for 'Group responsible', apply them
        if updated_group_count > 0:
            update_group_data = [
                {"id": row['record_id'], "fields": {"Group responsible": row['Group responsible_update']}}
                for _, row in merged_df[group_condition].iterrows()
            ]
            airtable_current.batch_update(update_group_data)
            merged_df.loc[group_condition, 'Group responsible'] = merged_df.loc[group_condition, 'Group responsible_update']
    else:
        
        # #################  Add Group responsible column in Published pages table in Airtable
        # #################  This is the initial addition of this Group responsible and will run only if it doesn't exists
        
        # Update current data in Airtable with a Group responsible column
        # This is only for the very first time we add Group responsible in Airtable for the current data
        # This won't be executed after this inital update
        group_condition = (merged_df['Group responsible'] != '')
        updated_group_count = group_condition.sum()

        # If updates are needed for 'Group responsible', apply them
        if updated_group_count > 0:
            update_group_data = [
                {"id": row['record_id'], "fields": {"Group responsible": row['Group responsible_update']}}
                for _, row in merged_df[group_condition].iterrows()
            ]
            airtable_current.batch_update(update_group_data)

    # Cleanup: remove redundant columns after updates
    if 'Group responsible_update' in merged_df.columns:
        merged_df.drop(columns=['Group responsible_update'], inplace=True)

    # Check if 'Section_update' exists in the DataFrame and drop it if it does
    if 'Section_update' in merged_df.columns:
        merged_df.drop(columns=['Section_update'], inplace=True)

    print(f"Group responsible updates: {updated_group_count}, Section updates: {updated_section_count}")


    # #-------------------LOAD AND PROCESS the AEM DATA-------------------------
    # #-------------------------------------------------------------------------


    # Load 'AEM data' data from a CSV file
    new_df = pd.read_csv(aemDatapath, dtype=str, encoding='utf-8')


    # Merge the new_df with merged_df to get the Group responsible column
    merged_new_df = pd.merge(new_df, merged_df[['Page path', 'Group responsible', 'Section', 'record_id']], on='Page path', how='left')

    # Find the difference
    difference_df = merged_new_df[~merged_new_df['Page path'].isin(merged_df['Page path'])].copy()

    # Check for duplicates in the difference (just in case)
    if difference_df.duplicated('Page path').any():
        print('Warning: There are duplicated records in the AEM data.')

    ##-----------------
    # Define the list of date columns to process
    date_columns = ['Date created', 'Date issued', 'Last Modified date', 'Last Published date']

    for column in date_columns:
        # Convert to datetime and format the date column, automatically handling NaT values
        difference_df[column] = pd.to_datetime(difference_df[column], errors='coerce').dt.strftime('%Y-%m-%d')
        # Replace NaT with None (or a default date if required)
        difference_df[column] = difference_df[column].where(difference_df[column].notna(), None)


    #print ("passed the fillna to empty on every non date column")
    # Drop the existing Group responsible(cause are empty) and merge with additional_df to get the proper Group responsible
    difference_df.drop('record_id', axis=1, inplace=True)
    difference_df.drop('Group responsible', axis=1, inplace=True)
    difference_df.drop('Section', axis=1, inplace=True)
    difference_df = pd.merge(difference_df, additional_df[['Page path', 'Group responsible']], on='Page path', how='left')
    difference_df = pd.merge(difference_df, sections_df, left_on='Page path', right_on='Unified URL', how='left')
    difference_df.drop('Unified URL', axis=1, inplace=True)

    #convert Group responsible column to string, insetead of a list
    difference_df['Group responsible'] = difference_df['Group responsible'].apply(lambda x: ', '.join(x) if isinstance(x, list) else x)
    #difference_df = difference_df.fillna('')
    #non_date_columns = [col for col in difference_df.columns if col not in date_columns]
    #difference_df[non_date_columns] = difference_df[non_date_columns].fillna('')

    # #-------------------SAVE NEW PAGES DATA IN Airtable------------------------

    # Prepare records to insert
    difference_df['New?'] = True
    records_to_insert = difference_df.to_dict('records')

    # Check of nan values exists and if yes - convert to None
    for my_dict in records_to_insert:
        for key, value in my_dict.items():
            if isinstance(value, (float, int)) and np.isnan(value):
                my_dict[key] = None
            if isinstance(value, pd.Timestamp):
                my_dict[key] = value.date().isoformat()

    # Export the difference to a new csv file
    current_date = datetime.now().strftime('%Y-%m-%d')

    filename = f"new_pages_{current_date}.csv"
    difference_df.to_csv(filename, index=False, encoding='utf-8')
    #difference_df.to_csv('data/new_pages.csv', index=False, encoding='utf-8')
    print("Successfully exported the new list of published page to local directory.")

    # Insert the new records into Airtable
    airtable_current.batch_insert(records_to_insert)

    print(f"Successfully added {len(difference_df)} new Pages in AT")

    # except Exception as e:
    #     print('An error occurred:', e)
        
    print('Time elapsed (hh:mm:ss.ms) {}'.format(datetime.now() - start_time))

if __name__ == "__main__":
    main()