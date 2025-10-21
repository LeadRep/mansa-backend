add to customerPref
* aiQuearyParam
* apollo total pages
* apollo current page
* step***
viewed leads id and date last viewed


when leads are refreshed update their status to viewed and number of times viewed to +1


when you view a leads contact, show a pop up to allow use add to pipeline 30sec
At the end of the current leads list, show previously generated leads before moving to next step


step2LeadGen is a function for generating leads and this is the workflow
1. get the user's customerPref
2. check if the customerPref has value for aiQueryParams, if it doesn't then use the aiPeopleSearchQuery function to gnerate it (also save it to the database)
3. use apolloPeopleSearch to fetch people from apollo, after fetching them remove those that already exist in the Leads table of the database having the owner_id as the userId, when we get to totalLeads we can move to the next step if not call the next page of apolloPeopleSearch untill we get totalLeads, also save the page we stoped in CustomerPref as currentPage so we can keep track
Note: after calling the apolloPeopleSearch is the CustomerPref has no totalPages, save the total pages apollo returned so we can tell when we've exhausted the list
4. use aiEvaluatedLeads to evaluate the filtered leads. for fast response send the entire leads but tell the ai to return only their id and the added parameters which are category, reason, and score. after getting the result you can now get their other data and from the previous array and add them so we get the full info of each of the leads

5. then we can save them to the leads table
Note: id is generated using v4, external_id is the id of the lead, owner_id is userId, views should be set to 1, status should be new

work on step1LeadGen
it should be same process with step1LeadGen, the only difference is that it runs organization search first before people search

the flow will be this way
generate organization search query using aiOrganizationSearchQuery then use apolloOrganizationSearch to get the organizations from apollo, the organizations are normally returned in pages so we have to go page by page to get the organizations id and then use the their ids to get the people in those organinzation we need using



fix the refresh number ending at zero

now let's make a few other adjustments, whe i delete all the chats on the frontend i still see 2 chat empty chat history auto created, please fix this and when the send button is clicked the user should not be able to send another chat untill the response has been recieved, you change also add a stop sign instead so that the user knows that a process is ongoing and clicking the button again will stop the previous process