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
        val.resp_seconds = eval((val.responded_millis - val.received_millis) / 1000);
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
        { "data": "user"},
        { "data": "resp_seconds"}
       ]
      });     
    });
    oh.class.search().done(function(class_list){
      class_data = $.map(class_list, function(val,key){
        val.urn=key;
        val.member_count = _.size(val.usernames);
        val.campaign_count = _.size(val.campaigns);
        val.edit_button = '<button type="button" class="btn btn-success disabled" data-toggle="modal" data-target="#detail-modal" data-uuid="'+val['urn']+'">Edit</button>'
        //val.delete_button = '<button type="button" class="btn btn-success disabled" data-toggle="modal" data-target="#detail-modal" data-uuid="'+val['urn']+'">Edit</button>'
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
  createUserTable();
  });

  $(".navs").click(function($this){
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
    if ($("#user-modal-title").text() == 'Add User') {
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
    } else {
      oh.user.update({
        username: $("#modal-user-username").val(),
        admin: $("#modal-user-admin").prop('checked'),
        enabled: $("#modal-user-enabled").prop('checked'),
        new_account: $("#modal-user-new-account").prop('checked'),
        campaign_creation_privilege: $("#modal-user-create-campaigns").prop('checked'),
        first_name: $("#modal-user-first-name").val(),
        last_name: $("#modal-user-last-name").val(),
        organization: $("#modal-user-org").val(),  
        personal_id: $("#modal-user-personal-id").val(),
        user_setup_privilege: $("#modal-user-setup-users").prop('checked'),
        class_creation_privilege: $("#modal-user-create-classes").prop('checked'),        
      }).done(function(){
        reloadUserTable();
        $("#user-modal").modal('toggle');
      })
    }
  });

  $(".user-batch").on('click', function(){
    if ($(this).hasClass('false')){
      var state = false
    } else {
      var state = true
    }
    //this is so ugly.
    if ($(this).hasClass('enabled_account')) {
      batchUserUpdate('enabled', state);
    } else if ($(this).hasClass('new_account')) {
      batchUserUpdate('new_account', state);
    } else if ($(this).hasClass('campaign_creation_privilege')) {
      batchUserUpdate('campaign_creation_privilege', state);
    } else if ($(this).hasClass('class_creation_privilege')) {
      batchUserUpdate('class_creation_privilege', state);
    } else if ($(this).hasClass('user_setup_privilege')) {
      batchUserUpdate('user_setup_privilege', state);
    } else if ($(this).hasClass('delete')) {
      delete_selected_users();
    }
  });

  $('#user-modal').on('show.bs.modal', function (event) {
    var button = $(event.relatedTarget);
    if(button.data('username')){
      var tr = $(button).closest("tr");
      var row = user_table.row(tr);
      var data = row.data();
      $("#user-modal-title").text('Edit User');
      $("#user-modal-password-form").hide();
      $("#modal-user-save").text("Update");
      $("#ChangePwAccordion").show();     
      insertUserData(data);
    } else {
      clearUserModal();
      $("#modal-user-new-account").prop("checked", true);
      $("#modal-user-enabled").prop("checked", true);
      $("#user-modal-title").text('Add User');
      $("#user-modal-password-form").show();
      $("#modal-user-save").text("Create");
      $("#ChangePwAccordion").hide();
    }
  });

  $(".show-hide-pw").on('click', function(){
    if ($(this).children('span').hasClass('glyphicon-eye-open')) {
      $(this).children('span').removeClass('glyphicon-eye-open').addClass('glyphicon-eye-close');
      $(this).prev(':input').prop("type", "text");
    } else {
      $(this).children('span').removeClass('glyphicon-eye-close').addClass('glyphicon-eye-open');
      $(this).prev(':input').prop("type", "password");   
    }
  });

  $("#modal-user-change-pw-submit").on('click', function(){
    oh.user.whoami().done(function(admin_me){
      oh.user.change_password({
        user: admin_me,
        username: $("#modal-user-username").val(),
        password: $("#modal-user-change-pw-admin").val(),
        new_password: $("#modal-user-change-pw-user").val()
      }).done(function(){
        alert("Successfully changed password");
        $("#ChangePwCollapse").collapse('hide');
        $("#modal-user-change-pw-admin").val('');
        $("#modal-user-change-pw-user").val('');
      });
    });
  });

  //helpers!
  function getChecked() {
    var user_list = [];
    $("tbody tr[role='row']").each(function(i){
        var tr = $(this);
        var row = user_table.row(tr);
        var data = row.data();
        var checkbox = tr.find(":checkbox");
        if(checkbox.is(':checked')){
          user_list.push(data.username);
        }
    });
    return user_list;
  }
  function batchUserUpdate(action, state) {
    $.each(getChecked(), function(i,u){
      oh.user.update({
        username: u,
        action: state
      });
    });
  };

  function insertUserData(data) {
    clearUserModal();
    $("#modal-user-username").val(data.username).prop('disabled', true);
    $("#modal-user-email").val(data.email_address);
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
      oh.user.delete({user_list: getChecked().toString()}).done(function(){
        alert("Successfully delete users!");
        reloadUserTable();
      });
  }
  function userInfo(user_list) {
    //this handles the manipulation from the user.search call
    user_data = $.map(user_list, function(val,key){
      val.checkbox = '<input type="checkbox" class="rowcheckbox">'
      val.username=key;
      val.email_address = val.email_address || "";
      if (!val.personal) {
        val.personal = {};
        val.personal.first_name = "";
        val.personal.last_name = "";
        val.personal.organization = "";
        val.personal.personal_id = "";
      }
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
        { "data": "personal.first_name" },
        { "data": "personal.last_name" },
        { "data": "personal.organization" },
        { "data": "personal.personal_id" },
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
  function get15minutesago(){
    d = new Date();
    d.setMinutes(d.getMinutes() - 15);
    return d.toISOString();
  };
  function getLocalTime(timestamp){
    d = new Date(timestamp);
    return d.toLocaleTimeString();
  };
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
