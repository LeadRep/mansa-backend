lets create step1LeadGen, this is the flow;
1. create an empty array to save leads to evaluate, another array to save evaluated leads, pageToFetch, TotalPage

2. fetch TempLeads whose owner_id is the userId and save them to leads to evaluate array, if there are no temp leads proceed to next step3, if there are leads proceed to step4 

3. fetch the user customerPref and set leadsGenerationStatus to ongoing, get the aiQueryParams from customerPref if there is no aiQueryParams generate it using aiPeopleSearchQuery function and save to customerPref, if there is aiQueryParams check if currentPage is less than totalPages, if yes then set pageToFetch to currentPage +1. but if currentPage is greater than or equal to then remove the very of these items you find on this list from the aiQueryParams object; include_similar_titles, person_seniorities, contact_email_status, organization_locations, organization_num_employees_ranges, revenue_range[min], revenue_range[max],  

3. call apolloPeopleSearch using the aiQueryParams
4. 
3. Check if there leads in TempLeads table for the user, if yes then check if they are up to totalLeads and if they already exist in Leads table for the user(if you get up to totalLeads skip step 4 else continue to step4), if the user don't have leads on step4 proceed to step 4
4.  take the totalLeads required and check if they exist in Leads for the particular user, if they do delete them from TempLeads table and and continue finding till you get totalLeads required if after going through you don't get the total number you need call the next page on appollo, if there is no next page proceed to step 5
5. 



