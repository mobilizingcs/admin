//initiate the client
var oh = Ohmage("/app", "admin-tool");

//attach global callbacks
oh.callback("done", function(x, status, req){
});

//global error handler. In ohmage 200 means unauthenticated
oh.callback("error", function(msg, code, req){
	(code == 200) ? window.location.replace("../web/#login") : alert("Error!\n" + msg);
});

//main app
$(function() {
  oh.user.whoami().done(function(username){
    oh.keepalive();
    oh.user.info().done(function(x){
      if (x[username]['permissions']['is_admin'] == false) {
        alert('This tool is only available for administrators. You will now be redirected...');
        window.location.replace("/");
      }
    });
    oh.campaign.search().done(function(campaigns){
      var campaign_count = _.size(campaigns);
      $("#campaign_count").text(campaign_count);
    });
    oh.audit.read({start_date: get15minutesago()}).done(function(audits){
      var audit_total_count = _.size(audits);
      $("#total_calls").text(audit_total_count);
      sf_counts = _.countBy(audits, function(x){
        if (x.response.result == "success") {
          return 'success';
        } else {
          return 'failure';
        }
      });
      $("#success_calls").text(sf_counts["success"]);
      $("#failure_calls").text(sf_counts["failure"]);
      var audits_table = $('#audits_table').DataTable( {
       "data": audits,
       "lengthMenu": [[25, 50, 100, -1], [25, 50, 100, "All"]],
       "oSearch": {"sSearch": "",
        "bRegex": true
       },
       "columns": [
        { "data": "uri" },
        { "data": "timestamp" }
       ]
      });     
    });
    oh.class.search().done(function(class_list){
      class_data = $.map(class_list, function(val,key){
        val.urn=key;
        val.member_count = _.size(val.usernames);
        val.campaign_count = _.size(val.campaigns);
        val.edit_button = '<button type="button" class="btn btn-success" data-toggle="modal" data-target="#detail-modal" data-uuid="'+val['urn']+'">Edit</button>'

        return val;
      });
      var class_table = $('#class_table').DataTable( {
       "data": class_data,
       "lengthMenu": [[25, 50, 100, -1], [25, 50, 100, "All"]],
       "oSearch": {"sSearch": "",
        "bRegex": true
       },
       "columns": [
        { "data": "name" },
        { "data": "urn" },
        { "data": "member_count" },
        { "data": "campaign_count" },
        { "data": "edit_button" }
       ]
      });
    })
    oh.user.search().done(function(user_list){
      user_data = $.map(user_list, function(val,key){
        val.username=key;
        //val.edit_button = '<button type="button" class="btn btn-success" data-toggle="modal" data-target="#detail-modal" data-uuid="'+val['urn']+'">Edit</button>'
        return val;
      });
      console.log(JSON.stringify(user_data))
      var user_table = $('#user_table').DataTable( {
       "data": user_data,
       "lengthMenu": [[25, 50, 100, -1], [25, 50, 100, "All"]],
       "oSearch": {"sSearch": "",
        "bRegex": true
       },
       "columns": [
        { "data": "username" }
        //{ "data": "email_address" }
       ]
      });
    })
  });

  $("li a").click(function($this){
    clicked = "#" + this.text.toLowerCase();
    $("li").removeClass('active');
    $(this).parent().addClass("active");
    hideAllExcept(clicked);
  });

  //helpers!
  function get15minutesago(){
    d = new Date();
    d.setMinutes(d.getMinutes() - 15);
    return d.toISOString();
  };
  function hideAllExcept(showElement){
    $.each(["#summary", "#classes", "#users", '#audits'], function(i,v){
      $(v).hide();
      $(showElement).show();
    });
  };
});
