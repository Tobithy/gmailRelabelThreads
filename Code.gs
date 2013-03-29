function relabelGmail() {
  
  var startTime= (new Date()).getTime(); // Time at start of script
  var BATCH=100; // total number of threads to apply label to at once.
  var LOOKBACKDAYS=4; // Days to look back for maintenance section of script. Should be at least 2
  var MAX_RUN_TIME=4*60*1000; // Time in ms for max execution. 4 minutes is a good start.
  var WAIT_TIME=4*60*1000; // Time in ms to wait before starting the script again.
  Logger.clear();
  
  
  
//  ScriptProperties.deleteAllProperties(); return; // Uncomment this line and run once to start over completely
  
  if(ScriptProperties.getKeys().length==0){ // this is to create keys on the first run
    ScriptProperties.setProperties({'itemsProcessed':0, 'initFinished':false, 'lastrun':'20000101', 'itemsProcessedToday':0, 
                                    'currentLabel':'null-label-NOTREAL', 'currentLabelStart':0, 'autoTrig':0, 'autoTrigID':'0'});
  }
  
  var itemsP = Number(ScriptProperties.getProperty('itemsProcessed')); // total counter
  var initTemp = ScriptProperties.getProperty('initFinished'); // keeps track of when initial run is finished. 
  var initF = (initTemp.toLowerCase() == 'true'); // Make it boolean
  
  var lastR = ScriptProperties.getProperty('lastrun'); // String of date corresponding to itemsProcessedToday in format yyyymmdd
  var itemsPT = Number(ScriptProperties.getProperty('itemsProcessedToday')); // daily counter
  var currentL = ScriptProperties.getProperty('currentLabel'); // Label currently being processed
  var currentLS = Number(ScriptProperties.getProperty('currentLabelStart')); // Thread number to start on
  
  var autoT = Number(ScriptProperties.getProperty('autoTrig')); // Number to say whether the last run made an automatic trigger
  var autoTID = ScriptProperties.getProperty('autoTrigID'); // Unique ID of last written auto trigger
  
  // First thing: google terminates scripts after 5 minutes. 
  // If 4 minutes have passed, this script will terminate, write some data, 
  // and create a trigger to re-schedule itself to start again in a few minutes. 
  // If an auto trigger was created last run, it is deleted here.
  if (autoT) {
    var allTriggers = ScriptApp.getProjectTriggers();
    
    // Loop over all triggers. If trigger isn't found, then it must have ben deleted.
    for(var i=0; i < allTriggers.length; i++) {
      if (allTriggers[i].getUniqueId() == autoTID) {
        // Found the trigger and now delete it
        ScriptApp.deleteTrigger(allTriggers[i]);
        break;
      }
    }
    autoT = 0;
    autoTID = '0';
  }
  
  var today = dateToStr_();
  if (today == lastR) { // If new day, reset daily counter
    // Don't do anything
  } else {
    itemsPT = 0;
  }
  
  if (!initF) { // Don't do any of this if the initial run has been completed
    var labels = GmailApp.getUserLabels();
    
    // Find position of last label attempted
    var curLnum=0;
    for ( ; curLnum < labels.length; curLnum++) { 
      if (labels[curLnum].getName() == currentL) {break};
    }
    if (curLnum == labels.length) { // If label isn't found, start over at the beginning
      curLnum = 0;
      currentLS = 0;
      itemsP=0;
      currentL=labels[1].getName();
    }
    
    // Now start working through the labels until the quota is hit.
    // Use a try/catch to stop execution if your quota has been hit. 
    // Google can actually automatically email you, but we need to clean up a bit before terminating the script so it can properly pick up again tomorrow.
    try {
      for (var i = curLnum; i < labels.length; i++) {
        currentL = labels[i].getName(); // Next label
        Logger.log('label: ' + i + ' ' + currentL);
        
        var threads = labels[i].getThreads(currentLS,BATCH);
        
        for (var j = Math.floor(currentLS/BATCH); threads.length > 0; j++) {
          var currTime = (new Date()).getTime();
          if (currTime-startTime > MAX_RUN_TIME) {
            
            // Make the auto-trigger
            autoT = 1; // So the auto trigger gets deleted next time.
            
            var autoTrigger = ScriptApp.newTrigger('relabelGmail')
            .timeBased()
            .at(new Date(currTime+WAIT_TIME))
            .create();
            
            autoTID = autoTrigger.getUniqueId();
            
            // Now write all the values.
            ScriptProperties.setProperties({'itemsProcessed':itemsP, 'initFinished':initF, 'lastrun':today, 'itemsProcessedToday':itemsPT, 
                                            'currentLabel':currentL, 'currentLabelStart':currentLS, 'autoTrig':autoT, 'autoTrigID':autoTID});
            
            // Send an email
            var emailAddress = Session.getActiveUser().getEmail();
            GmailApp.sendEmail(emailAddress, 'Relabel job in progress', 'Your Gmail Relabeller has halted to avoid termination due to excess ' +
                               'run time. It will run again in ' + WAIT_TIME/1000/60 + ' minutes.\n\n' + itemsP + ' threads have been processed. ' + itemsPT + 
                               ' have been processed today.\n\nSee the log below for more information:\n\n' + Logger.getLog());
            return;
          } else {
            // keep on going
            var len = threads.length;
            Logger.log( j * BATCH + len);
            
            labels[i].addToThreads(threads);
            
            currentLS = currentLS + len;
            itemsP = itemsP + len;
            itemsPT = itemsPT + len;
            threads = labels[i].getThreads( (j+1) * BATCH, BATCH);
          }
        }
        
        currentLS = 0; // Reset LS counter
      }
      
      initF = true; // Initial run is done
      
    } catch (e) { // Clean up and send off a notice. 
      // Write current values back to ScriptProperties
      ScriptProperties.setProperties({'itemsProcessed':itemsP, 'initFinished':initF, 'lastrun':today, 'itemsProcessedToday':itemsPT, 
                                      'currentLabel':currentL, 'currentLabelStart':currentLS, 'autoTrig':autoT, 'autoTrigID':autoTID});
      
      var emailAddress = Session.getActiveUser().getEmail();
      var errorDate = new Date();
      GmailApp.sendEmail(emailAddress, 'Error "' + e.name + '" in Google Apps Script', 'Your Gmail Relabeller has failed in the following stack:\n\n' + 
                         e.stack + '\nThis may be due to reaching your daily Gmail read/write quota. \nThe error message is: ' + 
                         e.message + '\nThe error occurred at the following date and time: ' + errorDate + '\n\nThus far, ' + 
                         itemsP + ' threads have been processed. ' + itemsPT + ' have been processed today. \nSee the log below for more information:' + 
                         '\n\n' + Logger.getLog());
      return;
    }
    
    // Write current values back to ScriptProperties. Send completion email.
    ScriptProperties.setProperties({'itemsProcessed':itemsP, 'initFinished':initF, 'lastrun':today, 'itemsProcessedToday':itemsPT, 
                                    'currentLabel':currentL, 'currentLabelStart':currentLS, 'autoTrig':autoT, 'autoTrigNumber':autoTID});
    
    var emailAddress = Session.getActiveUser().getEmail();
    GmailApp.sendEmail(emailAddress, 'Relabel job completed', 'Your Gmail Relabeller has finished its initial run.\n' + 
                       'If you continue to run the script, it will skip the initial run and instead relabel ' + 
                       'all emails from the previous ' + LOOKBACKDAYS + ' days.\n\n' + itemsP + ' threads were processed. ' + itemsPT + 
                       ' were processed today. \nSee the log below for more information:' + '\n\n' + Logger.getLog());
    
    return; // Don't run the maintenance section after initial run finish
    
  } // End initial run section statement
  
  
  // Below is the 'maintenance' section that will be run when the initial run is finished. It finds all new threads
  // (as defined by LOOKBACKDAYS) and applies any existing labels to all messages in each thread. Note that this 
  // won't miss older threads that are labeled by the user because all messages in a thread get the label
  // when the label action is first performed. If another message is then sent or received in that thread, 
  // then this maintenance section will find it because it will be deemed a "new" thread at that point. 
  // You may need to search further back the first time you run this if it took more than 3 days to finish
  // the initial run. For general maintenance, though, 4 days should be plenty.
  
  // Note that I have not implemented a script-run-time check for this section. 
  
  var threads = GmailApp.search('newer_than:' + LOOKBACKDAYS + 'd', 0, BATCH); // 
  var len = threads.length;
  
  for (var i=0; len > 0; i++) {
    
    for (var t = 0; t < len; t++) {
      var labels = threads[t].getLabels();
      
      for (var l = 0; l < labels.length; l++) { // Add each label to the thread
        labels[l].addToThread(threads[t]);
      }
    }
    
    itemsP = itemsP + len;
    itemsPT = itemsPT + len;
    
    threads = GmailApp.search('newer_than:' + LOOKBACKDAYS + 'd', (i+1) * BATCH, BATCH); 
    len = threads.length;
  }
  // Write the property data
  ScriptProperties.setProperties({'itemsProcessed':itemsP, 'initFinished':initF, 'lastrun':today, 'itemsProcessedToday':itemsPT, 
                                  'currentLabel':currentL, 'currentLabelStart':currentLS, 'autoTrig':autoT, 'autoTrigID':autoTID});
}


// Takes a date object and turns it into a string of form yyyymmdd
function dateToStr_(dateObj) { //takes in a date object, but uses current date if not a date
  
  if (!(dateObj instanceof Date)) {
    dateObj = new Date();
  }
  
  var dd = dateObj.getDate();
  var mm = dateObj.getMonth()+1; //January is 0!
  var yyyy = dateObj.getFullYear();
  
  if(dd<10){dd='0'+dd}; 
  if(mm<10){mm='0'+mm};
  dateStr = ''+yyyy+mm+dd;
  
  return dateStr;
  
}
