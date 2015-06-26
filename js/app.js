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

  $("#refresh_button").click(function(){
    refreshAll();
  })

  $(".navs").click(function($this){
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

  $("#class_detail_toggle").on('click', function(event) {
    $("#class_table_div").toggle();
    $("#class_detail_div").toggle();
    if ($(this).hasClass('btn-success')) {
      $(this).text("New Class").addClass('btn-primary').removeClass('btn-success');
      classTable();
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
        userTable;
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
        userTable;
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
        userTable;
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
  function userTable(){
    oh.user.search().done(function(user_list){
      if (!$.fn.DataTable.isDataTable('#user_table')) {
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
      } else {
        user_table.clear();
        user_table.rows.add(userInfo(user_list));
        user_table.draw();
      };
    });
  };
  function classTable(){
    oh.class.search().done(function(class_list){
      class_data = $.map(class_list, function(val,key){
        val.urn=key;
        val.member_count = _.size(val.usernames);
        val.campaign_count = _.size(val.campaigns);
        val.edit_button = '<button type="button" class="btn btn-success class-detail" data-urn="'+val['urn']+'">Edit</button>'
        //val.delete_button = '<button type="button" class="btn btn-success disabled" data-toggle="modal" data-target="#detail-modal" data-uuid="'+val['urn']+'">Edit</button>'
        return val;
      });
      if (!$.fn.DataTable.isDataTable('#class_table')) {
      class_table = $('#class_table').DataTable( {
       "initComplete": function(){
         $(".class-detail").on('click', function (event){
           $("#class_table_div").toggle();
           $("#class_detail_div").toggle();
           classDetailTable($(this).data('urn'));
           $("#modal-class-urn").val($(this).data('urn'));
           $("#class_detail_toggle").text("Back").removeClass('btn-primary').addClass('btn-success');
         });
       },
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
    } else {
      class_table.clear();
      class_table.rows.add(class_data);
      class_table.draw();
    }
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
  function auditsTable(audit_data){
    if (!$.fn.DataTable.isDataTable('#audits_table')) {
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
    } else {
      audits_table.clear();
      audits_table.rows.add(audit_data);
      audits_table.draw();
    }
  }
  function classDetailTable(urn){
    oh.class.read({class_urn_list: urn}).done(function(data){
      class_detail_data = $.map(data[urn].users, function(i,v){
        var role_button = '<button type="button" class="btn btn-default btn-sm role-button">'+i+'</button>';
        var checkbox = '<input type="checkbox" class="rowcheckbox">'
        var remove_button = '<button type="button" class="btn btn-danger btn-sm class-remove-user-button">Remove</button>';
        return { "checkbox":checkbox, 
                 "username": v, 
                 "role_button": role_button, 
                 "role":i, 
                 "remove_button":remove_button
               };
      });
      if (!$.fn.DataTable.isDataTable('#class_detail_table')) {
      class_detail_table = $('#class_detail_table').DataTable({
       "data": class_detail_data,
       "initComplete": function(){
         $(".role-button").on('click', function (){
           
           roleUpdateButton(this);
         });
         $(".class-remove-user-button").on('click', function(){

         }
       },
       "lengthMenu": [[25, 50, 100, -1], [25, 50, 100, "All"]],
       "oSearch": {"sSearch": "",
        "bRegex": true
       },
       //"order": [[ 1, "asc" ]],
       "columns": [
        { "data": "checkbox"},
        { "data": "username"},
        { "data": "role_button" },
        { "data": "remove_button"}
       ]
      });
    } else {
      class_detail_table.clear();
      class_detail_table.rows.add(class_detail_data);
      class_detail_table.draw();
    }
    });
  }
  function refreshAll(){
      oh.campaign.search().done(function(campaigns){
        var campaign_count = _.size(campaigns);
        $("#campaign_count").text(campaign_count);
      });
      oh.audit.read({start_date: get15minutesago()}).done(function(audits){
        $("#total_calls").text(_.size(audits));
        sf_counts = _.countBy(audits, function(x){
          return (x.response.result == "success") ? "success" : "failure";
        });
        $("#success_calls").text(sf_counts["success"]);
        $("#failure_calls").text(sf_counts["failure"]);
        audit_data = $.map(audits, function(val,key){
          val.uuid = uuid();
          val.localtime = getLocalTime(val.timestamp);
          val.user = val.extra_data['user'] || '';
          val.resp_seconds = eval((val.responded_millis - val.received_millis) / 1000);
          return val;
        });
        auditsTable(audit_data);    
      });
    classTable();
    userTable();
  }
  function roleUpdateButton(el){
    var button = el;
    var tr = $(el).closest("tr");
    var row = class_detail_table.row(tr);
    var data = row.data();
    var new_role = (data.role == 'privileged') ? 'restricted' : 'privileged';
    var update_list = data.username+';'+new_role;
    oh.class.update({
      class_urn: $("#modal-class-urn").val(), 
      user_role_list_add: update_list
    }).done(function(){
     data.role = new_role;
     $(button).text(new_role);
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
