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
        audit_data = $.map(audits, function(val,key){
        val.uuid = uuid();
        //val.result = val.response.result;
        val.localtime = getLocalTime(val.timestamp);
        val.user = val.extra_data['user'] || 'N/A';
        return val;
        });
      audits_table = $('#audits_table').DataTable( {
       "data": audit_data,
       "lengthMenu": [[25, 50, 100, -1], [25, 50, 100, "All"]],
       "oSearch": {"sSearch": "",
        "bRegex": true
       },
       "order": [[ 0, "desc" ]],
       "columns": [
        { "data": "localtime" },
        { "data": "uri"},
        { "data": "response.result" },
        { "data": "user"}
       ]
      });     
    });
    oh.class.search().done(function(class_list){
      class_data = $.map(class_list, function(val,key){
        val.urn=key;
        val.member_count = _.size(val.usernames);
        val.campaign_count = _.size(val.campaigns);
        val.edit_button = '<button type="button" class="btn btn-success disabled" data-toggle="modal" data-target="#detail-modal" data-uuid="'+val['urn']+'">Edit</button>'

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
        val.email_address = val.email_address || "N/A";
        val.name = getName(val);
        val.campaign_count = _.size(val.campaigns);
        val.class_count = _.size(val.classes);
        val.edit_button = '<button type="button" class="btn btn-success disabled" data-toggle="modal" data-target="#user-modal" data-uuid="'+val['username']+'">Edit</button>'

        //val.edit_button = '<button type="button" class="btn btn-success" data-toggle="modal" data-target="#detail-modal" data-uuid="'+val['urn']+'">Edit</button>'
        return val;
      });
      var user_table = $('#user_table').DataTable({
       "data": user_data,
       "lengthMenu": [[25, 50, 100, -1], [25, 50, 100, "All"]],
       "oSearch": {"sSearch": "",
        "bRegex": true
       },
       "columns": [
        { "data": "username" },
        { "data": "name" },
        { "data": "email_address" },
        { "data": "permissions.admin" },
        { "data": "permissions.enabled" },
        { "data": "class_count" },
        { "data": "campaign_count" },
        { "data": "edit_button" }
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

  $('#audits_table').on('click', 'tbody tr', function () {
      var tr = $(this).closest('tr');
      var row = audits_table.row( tr );
  
      if ( row.child.isShown() ) {
          // This row is already open - close it
          row.child.hide();
          tr.removeClass('shown');
      }
      else {
          // Open this row
          row.child( audit_row(row.data()) ).show();
          tr.addClass('shown');
      }
  });

  //helpers!
  function get15minutesago(){
    d = new Date();
    d.setMinutes(d.getMinutes() - 15);
    return d.toISOString();
  };
  function getLocalTime(timestamp){
    d = new Date(timestamp);
    return d.toLocaleTimeString();
  };
  function getName(val){
    if (val.personal) {
      return val.personal.first_name + " " + val.personal.last_name
    } else {
      return "N/A"
    }
  }
  function hideAllExcept(showElement){
    $.each(["#summary", "#classes", "#users", '#audits'], function(i,v){
      $(v).hide();
      $(showElement).show();
    });
  };
  //uuid generator
  function uuid() {
   var uuid = "", i, random;
   for (i = 0; i < 32; i++) {
      random = Math.random() * 16 | 0;
      if (i == 8 || i == 12 || i == 16 || i == 20) {
         uuid += "-"
      }
        uuid += (i == 12 ? 4 : (i == 16 ? (random & 3 | 8) : random)).toString(16);
      }
    return uuid;
  };
  function audit_row(audit){
      var row = $('<div/>').addClass('row').addClass("audit-row");
      var table = $('<table/>').addClass('table').appendTo(row);
      table.append('<th>Key</th><th>Value</th>');
        $.each(audit, function(key, value){
          table.append('<tr><td>'+key+'</td><td>'+JSON.stringify(value)+'</td></tr>');         
        });
      return row;
  }
});
