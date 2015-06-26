//initiate the client
var oh = Ohmage("/app", "admin-tool");

//attach global callbacks
oh.callback("done", function(x, status, req){
});

//global error handler. In ohmage 200 means unauthenticated
oh.callback("error", function(msg, code, req){
	(code == 200) ? window.location.replace("/login.html") : alert("Error!\n" + msg);
});

//main app
$(function() {
  var campaign_count;
  var audit_data;
  var class_data;
  oh.user.whoami().done(function(username){
    oh.keepalive();
    oh.user.info().done(function(x){
      if (x[username]['permissions']['is_admin'] == false) {
        alert('This tool is only available for administrators. You will now be redirected...');
        window.location.replace("/");
      } else {
        reloadData(function(){
          createSummary();
          createUserTable();
          createAuditTable();
          createClassTable();
        });
      }
    });
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
      if ( row.child.isShown() ) { //row is open, close.
          row.child.hide();
          tr.removeClass('shown');
      }
      else { // open row
          row.child( audit_row(row.data()) ).show();
          tr.addClass('shown');
      }
  });

  $("#class_detail_toggle").on('click', function() {
    $("#class_table_div").toggle();
    $("#class_detail_div").toggle();
    if ($(this).hasClass('btn-success')) {
      $(this).text("New Class").addClass('btn-primary').removeClass('btn-success');
    } else {
      $(this).text("Back").removeClass('btn-primary').addClass('btn-success');
    }
  });

  $("#modal-user-save").on('click', function() {
    //validate first, duh.
    oh.user.create({
      username: $("#modal-user-username").val(),
      password: $("#modal-user-password").val(),
      admin: $("#modal-user-admin").prop('checked'),
      enabled: $("#modal-user-enabled").prop('checked'),
      new_account: $("#modal-user-new-account").prop('checked'),
      campaign_creation_privilege: $("#modal-user-create-campaigns").prop('checked')
    }).done(function(){
      reloadUserTable();
      $("#user-modal").modal('toggle');
    });
  });

  $("#delete-users-btn").on('click', function(){
    delete_selected_users();
  })

  $('#user-modal').on('show.bs.modal', function (event) {
    var button = $(event.relatedTarget);
    if(button.data('username')){
      var tr = $(button).closest("tr");
      var row = user_table.row(tr);
      var data = row.data();
      console.log(data);
      insertUserData(data);
    } else {
      clearUserModal();
    }
  });

  //helpers!
  function createSummary(){
    $("#campaign_count").text(campaign_count);
    var audit_total_count = _.size(audit_data);
    $("#total_calls").text(audit_total_count);
      sf_counts = _.countBy(audit_data, function(x){
        r = x.response.result == "success" ? 'success' : 'failure';
        return r;
      });
    $("#success_calls").text(sf_counts["success"]);
    $("#failure_calls").text(sf_counts["failure"]);
  };
  function reloadData(fun){
    oh.campaign.search().done(function(campaigns){
      campaign_count = _.size(campaigns);
    });
    oh.class.search().done(function(class_list){
      class_data = $.map(class_list, function(val,key){
        val.urn=key;
        val.member_count = _.size(val.usernames);
        val.campaign_count = _.size(val.campaigns);
        val.edit_button = '<button type="button" class="btn btn-success disabled" data-toggle="modal" data-target="#detail-modal" data-uuid="'+val['urn']+'">Edit</button>'
        return val;
      });
    });
    oh.audit.read({start_date: get15minutesago()}).done(function(audits){
      audit_data = $.map(audits, function(val,key){
        val.uuid = uuid();
        val.localtime = getLocalTime(val.timestamp);
        val.user = val.extra_data['user'] || 'N/A';
        val.resp_seconds = eval((val.responded_millis - val.received_millis) / 1000);
        return val;
      });
      fun();
    });
  };
  function insertUserData(data) {
    clearUserModal();
    $("#modal-user-username").val(data.username).prop('disabled', true);
    if (data.email_address != "N/A") {
          $("#modal-user-email").val(data.email_address);
    }
    $("#modal-user-enabled").prop("checked", data.permissions.enabled);
    $("#modal-user-admin").prop("checked", data.permissions.admin);
    $("#modal-user-new-account").prop("checked", data.permissions.new_account);
    $("#modal-user-create-campaigns").prop("checked", data.permissions.can_create_campaigns);
    $("#modal-user-create-classes").prop("checked", data.permissions.can_create_classes);
    $("#modal-user-setup-users").prop("checked", data.permissions.can_setup_users);
    if (data.personal) {
      $("#modal-user-first-name").val(data.personal.first_name);
      $("#modal-user-last-name").val(data.personal.last_name);
      $("#modal-user-org").val(data.personal.organization);
      $("#modal-user-personal-id").val(data.personal.personal_id);
    }
  }
  function clearUserModal(){
    $("#user-modal .writer.form-control").val('').prop('disabled', false);
    $("#user-modal :checkbox").prop("checked", false);
  }
  function delete_selected_users(){
      if(!confirm("Are you sure you want to delete these users? This cannot be undone!")) return;
      var delete_user_list = [];
      $("tbody tr[role='row']").each(function(i){
          var tr = $(this);
          var row = user_table.row(tr);
          var data = row.data();
          var checkbox = tr.find(":checkbox");
          if(checkbox.is(':checked')){
            delete_user_list.push(data.username);
          }
      });
      oh.user.delete({user_list: delete_user_list.toString()}).done(function(){
        alert("Successfully delete users!");
        reloadUserTable();
      });
  }
  function userInfo(user_list) {
    //this handles the manipulation from the user.search call
    user_data = $.map(user_list, function(val,key){
      val.checkbox = '<input type="checkbox" class="rowcheckbox">'
      val.username=key;
      val.email_address = val.email_address || "N/A";
      val.name = getName(val);
      val.campaign_count = _.size(val.campaigns);
      val.class_count = _.size(val.classes);
      val.edit_button = '<button type="button" class="btn btn-success" data-toggle="modal" data-target="#user-modal" data-username="'+val['username']+'">Edit</button>';
      return val;
    });
    return user_data;  

  }
  function reloadUserTable() {
    user_table.clear();
    oh.user.search().done(function(user_list){
      user_table.rows.add(userInfo(user_list));
      user_table.draw();
    });
  }
  function createUserTable(){
    oh.user.search().done(function(user_list){
      user_table = $('#user_table').DataTable({
       "data": userInfo(user_list),
       "lengthMenu": [[25, 50, 100, -1], [25, 50, 100, "All"]],
       "oSearch": {"sSearch": "",
        "bRegex": true
       },
       "order": [[ 1, "asc" ]],
       "columns": [
        { "data": 'checkbox'},
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
    });
  };
  function createClassTable(){
    class_table = $('#class_table').DataTable( {
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
  }
  function createAuditTable(){
    audits_table = $('#audits_table').DataTable({
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
       { "data": "user"},
       { "data": "resp_seconds"}
      ]
    }); 
  }
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
