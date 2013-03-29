gmailRelabelThreads
===================

Google apps script to reapply all labels to all threads in a Gmail account. 
This is is needed because Gmail doesn't update new messages in a thread with the 
threads original label. This isn't obvious in the UI, which shows labels next 
to the conversation/thread subject, and not on the individual messages. This can 
have unintended consequences when searching.

For example, let's say you get an email and label it "Baseball", and later get a followup 
email that gets threaded with the first message, and you apply the label "Sports" (but not "Baseball" 
since it already looks like it has that label).
In the UI, it now looks like the thread is labeled "Baseball" and "Sports". But let's say 
you want to find all your messages labeled "Sports" but not "Baseball". 

So you do a search 
"label:sports -label:baseball". The second message above will appear in the search results because 
the message was only labeled "Sports" and didn't inherit the "Baseball" label from the first message 
in the thread. This will look funny in the results window because the label "Baseball" will still 
appear next to the subject of the thread. So it looks like the search isn't working, but it really is, 
it's just that Gmail search searches for messages, and not all messages in a thread have the same labels.
