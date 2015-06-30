//initiate the client
var oh = Ohmage("/app", "admin-tool");

//attach global callbacks
oh.callback("done", function(x, status, req){
});

//global error handler. In ohmage 200 means unauthenticated
oh.callback("error", function(msg, code, req){
	(code == 200) ? window.location.replace("/login.html") : message("Error!\n" + msg);
});


//main app
$(function() {
  var campaign_count;
  var audit_data;
  var class_data;
  var user_data;
  var campaign_data;
  var me;
  oh.user.whoami().done(function(username){
    me = username;
    oh.keepalive();
    oh.user.info().done(function(x){
      if (x[username]['permissions']['is_admin'] == false) {
        alert('This tool is only available for administrators. You will now be redirected...');
        window.location.replace("/");
      } else {
        $("#refresh_button").trigger('click');
      }
    });
  });

  $(".navs").click(function(e){
    e.preventDefault();
    var nav_name = this.text.toLowerCase();
    var clicked = "#" + nav_name;
    $(".navs").parent().removeClass('active');
    $(this).parent().addClass("active");
    hideAllExcept(clicked);
    if (nav_name == 'classes'){
      displayClassMain();
    } else if (nav_name == 'users'){
      displayUserMain();
    }
  });

  $("#refresh_button").click(function(){
    $(this).addClass("gly-spin");
    reloadData(function(){
      createSummary();
      userTable();
      auditsTable();
      classTable();
      $("#refresh_button").removeClass("gly-spin");
    });
  })

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

  $("#new-user-button").click(function(e){
    e.preventDefault();
    emptyForm("#user-detail-div");
    displayUserDetail();
  });

  $("#back-to-user-button").click(function(e) {
    e.preventDefault();
    displayUserMain();
  });

  $("#new-class-button").click(function(e){
    e.preventDefault();
    displayClassDetail();
    emptyForm("#class-metadata");
  });

  $("#back-to-class-button").click(function(e) {
    e.preventDefault();
    displayClassMain();
  });

  $("#class-detail-metadata-save").click(function(e){
    e.preventDefault();
    if ($(this).hasClass('edit')) {
      oh.class.update({
        class_urn: $("#class-detail-urn").val(),
        class_name: $("#class-detail-name").val(),
        description: $("#class-detail-description").val()        
      }).done(function(){
        message($("#class-detail-urn").val() + " updated.", "success");
      });
    } else {
      var new_urn = $("#class-detail-urn").val()
      oh.class.create({
        class_urn: new_urn,
        class_name: $("#class-detail-name").val(),
        description: $("#class-detail-description").val()
      }).done(function(){
        message(new_urn + " created!", "success");
        $("#class-detail-urn").prop("disabled", true);
        $("#class-members").collapse('show');
        $("#class-detail-metadata-save").addClass('edit');
        classUserTable(new_urn);
      });
    }
  })

  $("#user-detail-save").on('click', function(e) {
    e.preventDefault();
    //validate first, duh.
    if ($("#user-modal-title").text() == 'Add User') {
      oh.user.create({
        username: $("#user-detail-username").val(),
        password: $("#user-detail-password").val(),
        admin: $("#user-detail-admin").prop('checked'),
        enabled: $("#user-detail-enabled").prop('checked'),
        new_account: $("#user-detail-new-account").prop('checked'),
        campaign_creation_privilege: $("#user-detail-create-campaigns").prop('checked')
      }).done(function(){
        refreshUser();
        $("#user-modal").modal('toggle');
      });
    } else {
      oh.user.update({
        username: $("#user-detail-username").val(),
        email_address: $("#user-detail-email").val(),
        admin: $("#user-detail-admin").prop('checked'),
        enabled: $("#user-detail-enabled").prop('checked'),
        new_account: $("#user-detail-new-account").prop('checked'),
        campaign_creation_privilege: $("#user-detail-create-campaigns").prop('checked'),
        first_name: $("#user-detail-first-name").val(),
        last_name: $("#user-detail-last-name").val(),
        organization: $("#user-detail-org").val(),  
        personal_id: $("#user-detail-personal-id").val(),
        user_setup_privilege: $("#user-detail-setup-users").prop('checked'),
        class_creation_privilege: $("#user-detail-create-classes").prop('checked'),        
      }).done(function(){
        refreshUser();
        $("#user-modal").modal('toggle');
      });
    }
  });

  $(".user-batch").on('click', function(){
    state = $(this).hasClass('false') ? false : true;
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

  $(".show-hide-pw").on('click', function(){
    if ($(this).children('span').hasClass('glyphicon-eye-open')) {
      $(this).children('span').removeClass('glyphicon-eye-open').addClass('glyphicon-eye-close');
      $(this).prev(':input').prop("type", "text");
    } else {
      $(this).children('span').removeClass('glyphicon-eye-close').addClass('glyphicon-eye-open');
      $(this).prev(':input').prop("type", "password");   
    }
  });

  $("#user-detail-change-pw-submit").on('click', function(e){
    e.preventDefault();
    oh.user.change_password({
      user: me,
      username: $("#user-detail-username").val(),
      password: $("#user-detail-change-pw-admin").val(),
      new_password: $("#user-detail-change-pw-user").val()
    }).done(function(){
      alert("Successfully changed password");
      $("#ChangePwCollapse").collapse('hide');
      $("#user-detail-change-pw-admin").val('');
      $("#user-detail-change-pw-user").val('');
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
    $("#class_count").text(_.size(class_data));
    $("#user_count").text(_.size(user_data));
  };
  function reloadData(fun){
    campaignSearch();
    classSearch();
    userSearch();
    auditRead(get15minutesago(), function(){
      fun();
    })
  };
  function refreshUser(){
    userSearch(function(){
      userTable();
    });
  };
  function refreshClass(){
    classSearch(function(){
      classTable();
    })
  };
  function campaignSearch(fun){
    oh.campaign.search().done(function(campaigns){
      campaign_data = $.map(campaigns, function(val,key){
        val.urn = key;
        return val;
      });
      campaign_data = _.sortBy(campaign_data, function(v){ return v.name });
      campaign_count = _.size(campaigns);
      fun = fun || function(){ return true }
      fun();
    });
  }
  function classSearch(fun){
    oh.class.search().done(function(class_list){
      class_data = $.map(class_list, function(val,key){
        val.urn=key;
        val.member_count = _.size(val.usernames);
        val.campaign_count = _.size(val.campaigns);
        val.edit_button = '<button type="button" class="btn btn-success class-detail" data-urn="'+val['urn']+'">Edit</button>'
        //val.delete_button = '<button type="button" class="btn btn-success disabled" data-toggle="modal" data-target="#detail-modal" data-uuid="'+val['urn']+'">Edit</button>'
        return val;
      });
      fun = fun || function(){ return true }
      fun();
    });
  }
  function auditRead(time, fun){
    oh.audit.read({start_date: time}).done(function(audits){
      audit_data = $.map(audits, function(val,key){
        val.uuid = uuid();
        val.localtime = getLocalTime(val.timestamp);
        val.user = val.extra_data['user'] || 'N/A';
        val.resp_seconds = eval((val.responded_millis - val.received_millis) / 1000);
        val.record = JSON.stringify(val);
        return val;
      });
      fun = fun || function(){ return true }
      fun();
    });
  }
  function userSearch(fun){
    oh.user.search().done(function(user_list){
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
        val.edit_button = '<button type="button" class="btn btn-success user-detail" data-username="'+val['username']+'">Edit</button>'
        return val;
      });
      fun = fun || function(){ return true }
      fun();
    });
  }
  function userTable(){
    if (!$.fn.DataTable.isDataTable('#user_table')) {
      user_table = $('#user_table').DataTable({
       "initComplete": function(){
         registerUserDetail();
       },
       "data": user_data,
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
      user_table.rows.add(user_data);
      user_table.draw();
      registerUserDetail();
    };
  };
  function registerUserDetail(){
    $(".user-detail").on('click', function (e){
      e.preventDefault();
      var username = $(this).data('username');
      var user_details = dtDataFromCell($(this), user_table);
      displayUserDetail(user_details);
    });
  };
  function displayUserDetail(details){
    $("#user-div").hide();
    $("#new-user-button").hide();
    $("#back-to-user-button").show();
    $("#user-detail-div").show();
    $("#bulk-action-button").hide();
    if (details == undefined){
      $("#user-detail-title").hide();
      $("#user-detail-save").removeClass("edit");
      $("#user-detail-username").prop('disabled', false);
    } else {
      $("#user-detail-title").show().text(details.username);
      $("#user-detail-save").addClass("edit");
      $("#user-detail-username").prop('disabled', true);
      insertUserData(details);

    }
  }
  function displayUserMain(){
    $("#user-div").show();
    $("#new-user-button").show();
    $("#back-to-user-button").hide();
    $("#user-detail-div").hide();
    $("#bulk-action-button").show();
    $("#user-detail-title").hide(); 
    refreshUser();
  }
  function classTable(){
      if (!$.fn.DataTable.isDataTable('#class_table')) {
      class_table = $('#class_table').DataTable( {
       "initComplete": function(){
         registerClassDetail();
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
      registerClassDetail();
    }
  };
  function auditsTable(){
    if (!$.fn.DataTable.isDataTable('#audits_table')) {
      audits_table = $('#audits_table').DataTable( {
       "data": audit_data,
       "lengthMenu": [[25, 50, 100, -1], [25, 50, 100, "All"]],
       "oSearch": {"sSearch": "",
        "bRegex": true
       },
       "order": [[ 0, "desc" ]],
       "columnDefs": [
         {
           "targets": [ 5 ],
           "visible": false,
         },
       ],
       "columns": [
        { "data": "localtime" },
        { "data": "uri"},
        { "data": "response.result" },
        { "data": "user"},
        { "data": "resp_seconds"},
        { "data": "record"}
       ]
      });
    } else {
      audits_table.clear();
      audits_table.rows.add(audit_data);
      audits_table.draw();
    }
  }
  function registerClassDetail(){
    $(".class-detail").on('click', function (e){
      e.preventDefault();
      var urn = $(this).data('urn');
      var class_details = dtDataFromCell($(this), class_table);
      displayClassDetail(urn, class_details);
    });
  }
  function displayClassMain(){
    $("#back-to-class-button").hide();
    $("#new-class-button").show();
    $("#class_table_div").show();
    $("#class_detail_div").hide();
    $("#class-detail-urn-title").hide();
    refreshClass();
  }
  function displayClassDetail(urn, details){
    $("#back-to-class-button").show();
    $("#new-class-button").hide();
    $("#class_table_div").hide();
    $("#class_detail_div").show();
    if (urn == undefined){ //pass no variables to function to make clear new class view.
      $("#class-members").removeClass('in');
      $("#class-detail-urn-title").hide();
      $("#class-detail-metadata-save").removeClass("edit");
      $("#class-detail-urn").prop('disabled', false);
    } else {
      $("#class-members").addClass('in');
      $("#class-detail-urn-title").show().text(urn);
      $("#class-detail-metadata-save").addClass("edit");
      $("#class-detail-urn").prop('disabled', true);
      insertClassData(details);
      classUserTable(urn);
    }
  }
  function classUserTable(urn){
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
  function insertClassData(details){
    $("#class-detail-urn").val(details.urn).prop('disabled', true);
    $("#class-detail-name").val(details.name);
    $("#class-detail-description").val(details.description);
    insertCampaignList(details);
  }
  function insertCampaignList(details){
    $("#class-detail-campaigns option").remove();
    _.each(campaign_data, function(v){
      var el = $(document.createElement("option")).appendTo($("#class-detail-campaigns"));
      el.attr("value",v.urn);
      el.text(v.name + " ("+v.urn+")");
      if (_.contains(details.campaigns, v.urn)){
        el.prop("selected", true);
      }
    })
    $("#class-detail-campaigns").chosen({search_contains: true}).trigger('chosen:updated');
  }
  function batchUserUpdate(action, state) {
    $.each(getChecked(user_table), function(i,u){
      oh.user.update({
        username: u,
        action: state
      });
    });
  };
  function insertUserData(data) {
    $("#user-detail-username").val(data.username);
    $("#user-detail-email").val(data.email_address);
    $("#user-detail-enabled").prop("checked", data.permissions.enabled);
    $("#user-detail-admin").prop("checked", data.permissions.admin);
    $("#user-detail-new-account").prop("checked", data.permissions.new_account);
    $("#user-detail-create-campaigns").prop("checked", data.permissions.can_create_campaigns);
    $("#user-detail-create-classes").prop("checked", data.permissions.can_create_classes);
    $("#user-detail-setup-users").prop("checked", data.permissions.can_setup_users);
    if (data.personal) {
      $("#user-detail-first-name").val(data.personal.first_name);
      $("#user-detail-last-name").val(data.personal.last_name);
      $("#user-detail-org").val(data.personal.organization);
      $("#user-detail-personal-id").val(data.personal.personal_id);
    }
  }
  function delete_selected_users(){
      if(!confirm("Are you sure you want to delete these users? This cannot be undone!")) return;
      oh.user.delete({user_list: getChecked(user_table).toString()}).done(function(){
        alert("Successfully delete users!");
        userTable;
      });
  }
  function roleUpdateButton(el){
    var data = dtDataFromCell(el);
    var new_role = (data.role == 'privileged') ? 'restricted' : 'privileged';
    var update_list = data.username+';'+new_role;
    oh.class.update({
      class_urn: $("#class-detail-urn").val(), 
      user_role_list_add: update_list
    }).done(function(){
     data.role = new_role;
     $(button).text(new_role);
    });
  };
  function getChecked(table) {
    var checked_list = [];
    table.$('tr').each(function(index,row){
      var checkbox = $(row).find(':checkbox');
      var data = table.row(index).data();
      if(checkbox.is(':checked')){
        var value = data.username ? data.username : data.urn;
        checked_list.push(value);
      }
    });
    return checked_list;
  }
  function emptyForm(formdiv){
    $(formdiv).find("input[type=text], input[type=password], input[type=email], textarea").val("");
    $(formdiv).find("input[type=checkbox]").prop('checked', false);
  }
  function dtDataFromCell(button, table){
    var tr = $(button).closest("tr");
    var row = table.row(tr);
    return row.data();
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
          if (key == "record") {
            //dont add this to the table, it's for searching
          } else {
            table.append('<tr><td>'+key+'</td><td>'+JSON.stringify(value)+'</td></tr>'); 
          }        
        });
      return row;
  }
});
function message(msg, type){ //global message function to pass messages to user.
  type = type || "danger"
  $("#error-div").empty().append('<div class="alert alert-' + type + '"><a href="#" class="close" data-dismiss="alert">&times;</a>' + msg + '</div>');
  $("#error-div").fadeIn(100);                                                                                                                                                                                                                   
};
