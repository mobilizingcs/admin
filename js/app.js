//initiate the client
var oh = Ohmage("/app", "admin-tool");

//attach global callbacks
oh.callback("done", function(x, status, req){
});

//global error handler. In ohmage 200 means unauthenticated
oh.callback("error", function(msg, code, req){
	(msg.match("token") || msg.match('Authentication credentials were not provided') || msg.match("New accounts aren't allowed to use this service")) ? window.location.replace("/login.html") : message("Error!\n" + msg);
});

function message(msg, type){ //global message function to pass messages to user.
  type = type || "danger"
  $("#error-div").empty().append('<div class="alert alert-' + type + '"><a href="#" class="close" data-dismiss="alert">&times;</a>' + msg + '</div>');
  $("#error-div").fadeIn(100);                                                                                                                                                                                                                   
};

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
        $("#refresh-button").trigger('click');
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

  $("#refresh-button").click(function(){
    $(this).addClass("gly-spin");
    reloadData(function(){
      createSummary();
      userTable();
      auditsTable();
      classTable();
      $("#refresh-button").removeClass("gly-spin");
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
    emptyForm("#class-metadata");
    displayClassDetail();
  });

  $("#back-to-class-button").click(function(e) {
    e.preventDefault();
    displayClassMain();
  });

  $("#class-detail-metadata-save").click(function(e){
    e.preventDefault();
    if ($(this).hasClass('edit')) {
      classUpdate();
    } else {
      classCreate();
    }
  });

  $('#user-detail-password').keyup(function() { //TODO: refactor, too much logic here.
    if ($("#user-detail-save").hasClass('edit')) {
      if ($("#user-detail-password").val() == '') {
        $("#user-detail-admin-password-div").fadeOut(300);
      } else {
        $("#user-detail-admin-password-div").is(":visible") ? true : $("#user-detail-admin-password-div").fadeIn(300);
      }
    }
  });

  $("#user-detail-save").on('click', function(e) { //TODO: refactor this.
    e.preventDefault();
    if ($(this).hasClass('edit')) {
      if ($("#user-detail-password").val() == '') {
        userDetailUpdate(function(){
          message("Successfully updated user details", "success")
        });
      } else {
        userUpdatePassword(function(){
          userDetailUpdate(function(){
            message("Successfully updated user details", "success")
          });
        });
      }
    } else { 
     userDetailCreate();
    }
  });

  $(".user-bulk").click(function(e){
    e.preventDefault();
    var state = $(this).data('state');
    var action = $(this).data('action');
    var action_users = getChecked(user_table);
    action == 'delete' ? deleteUser(action_users) : bulkUserUpdate(action, state);
  });

  $(".class-bulk").click(function(e){
    e.preventDefault();
    var role = $(this).data('role');
    var users = getChecked(class_detail_table);
    var urn = $("#class-detail-urn").val()
    role == 'remove' ? bulkUserClassRemove(urn, users) : bulkUserRole(urn, users, role);
  });

  $(".class-user-add").click(function(e){
    e.preventDefault();
    var role = $(this).data('role');
    var users = $("#class-user-add-token-search")[0].selectize.items;
    bulkUserRole($("#class-detail-urn").val(), users, role)
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
        val.edit_button = '<button type="button" class="btn btn-primary class-detail" data-urn="'+val['urn']+'">Edit</button>'
        val.delete_button = '<button type="button" class="btn btn-danger class-delete" data-urn="'+val['urn']+'">Delete</button>'
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
        val.edit_button = '<button type="button" class="btn btn-primary user-detail" data-username="'+val['username']+'">Edit</button>'
        val.delete_button = '<button type="button" class="btn btn-danger user-delete" data-username="'+val['username']+'">Delete</button>'
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
       "aoColumnDefs": [
          { 'bSortable': false, 'aTargets': [ 0, 11, 12] },
          { 'bSearchable': false, 'aTargets': [ 0, 11, 12] }
       ],
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
        { "data": "edit_button" },
        { "data": "delete_button"}
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
    $(".user-delete").click(function(e){
      e.preventDefault();
      var username = $(this).data('username');
      deleteUser(username);
    });
  };
  function userDetailCreate(){
    var new_user = $("#user-detail-username").val();
    oh.user.create({
      username: new_user,
      password: $("#user-detail-password").val(),
      admin: $("#user-detail-admin").prop('checked'),
      enabled: $("#user-detail-enabled").prop('checked'),
      new_account: $("#user-detail-new-account").prop('checked'),
      campaign_creation_privilege: $("#user-detail-create-campaigns").prop('checked')     
    }).done(function(){
      message('Successfully created user: '+new_user, "success");
      userDetailUpdate(function(){
        userSearch(function(){
          var new_user_details = _.findWhere(user_data, {username: new_user})
          displayUserDetail(new_user_details);
        });
      });
    }); 
  };
  function userDetailUpdate(fun){
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
      fun = fun || function(){ return true }
      fun();
    });
  };
  function userUpdatePassword(fun){
    var user = $("#user-detail-username").val()
    oh.user.change_password({
      user: me,
      username: user,
      password: $("#user-detail-admin-password").val(),
      new_password: $("#user-detail-password").val()
    }).done(function(){
      $("#user-detail-admin-password").val('');
      $("#user-detail-password").val('');
      $("#user-detail-admin-password-div").hide();
      fun = fun || function(){ return true };
      fun();
    });
  }
  function bulkUserRole(class_urn, user_array, role){
    var user_role_list_add = user_array.join(';'+role+',') + ";"+role;
    oh.class.update({
      class_urn: class_urn,
      user_role_list_add: user_role_list_add
    }).done(function(){
      user_array.length > 1 ? message("Successfully added users", "success") : true;
      userSearch(function(){
        displayClassDetail(class_urn);
      })
    });
  }
  function bulkUserClassRemove(class_urn, user_array){
    var user_list_remove = user_array.join(',');
    oh.class.update({
      class_urn: class_urn,
      user_list_remove: user_list_remove
    }).done(function(){
      user_array.length > 1 ? message("Successfully removed users", "success") : true;
      userSearch(function(){
        displayClassDetail(class_urn);
      })
    });
  }
  function displayUserDetail(details){
    $("#user-div").hide();
    $("#new-user-button").hide();
    $("#back-to-user-button").show();
    $("#user-detail-div").show();
    $("#bulk-action-button").hide();
    $("#user-detail-admin-password-div").hide();
    if (details == undefined){
      $("#user-detail-title").hide();
      $("#user-detail-save").removeClass("edit").text('Create User');
      $("#user-detail-username").prop('disabled', false);
      $("#user-detail-enabled").prop('checked', true);
      $("#user-detail-new-account").prop('checked', true);
    } else {
      $("#user-detail-title").show().text(details.username);
      $("#user-detail-save").addClass("edit").text('Update User');
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
       "aoColumnDefs": [
          { 'bSortable': false, 'aTargets': [ 4, 5] },
          { 'bSearchable': false, 'aTargets': [ 4, 5] }
       ],
       "columns": [
        { "data": "name" },
        { "data": "urn" },
        { "data": "member_count" },
        { "data": "campaign_count" },
        { "data": "edit_button" },
        { "data": "delete_button" }
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
      displayClassDetail(urn);
    });
    $(".class-delete").click(function(e){
      e.preventDefault();
      var urn = $(this).data('urn');
      deleteClass(urn);
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
  function displayClassDetail(urn){
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
      insertClassData(urn);
      insertCampaignList(urn);
      insertClassUserAdd(urn);
      classUserTable(urn);
    }
  }
  function classUpdateCampaign(class_urn){ //obviously needs a refactor
    var class_details = _.findWhere(class_data, {urn: class_urn});
    var current_campaign_list = class_details.campaigns;
    var new_campaign_list = $("#class-detail-campaigns")[0].selectize.items;
    var to_add = _.difference(new_campaign_list, current_campaign_list);
    var to_del = _.difference(current_campaign_list, new_campaign_list);
    _.each(to_add, function(v,i){
      oh.campaign.update({
        campaign_urn: v,
        class_list_add: class_urn
      }).done(function(){
        console.log('done update to add a class to: '+v);
      });
    })
    _.each(to_del, function(v,i){
      oh.campaign.update({
        campaign_urn: v,
        class_list_remove: class_urn
      }).done(function(){
        console.log('done update to remove a class to: '+v);
      });
    })
  }
  function classUpdate(){
    var class_urn = $("#class-detail-urn").val()
    oh.class.update({
      class_urn: class_urn,
      class_name: $("#class-detail-name").val(),
      description: $("#class-detail-description").val()        
    }).done(function(){
      classUpdateCampaign(class_urn);
      message(class_urn + " updated.", "success");
    });
  }
  function classCreate(){
    var new_urn = $("#class-detail-urn").val()
    oh.class.create({
      class_urn: new_urn,
      class_name: $("#class-detail-name").val(),
      description: $("#class-detail-description").val()
    }).done(function(){
      message(new_urn + " created!", "success");
      classSearch(function(){
        var new_class_details = _.findWhere(class_data, {urn: new_urn})
        displayClassDetail(new_urn);
      });
    });
  }
  function classUserTable(urn){
    oh.class.read({class_urn_list: urn}).done(function(data){
      class_detail_data = $.map(data[urn].users, function(i,v){
        if (i == 'privileged') {
          var role_button = '<button type="button" class="btn btn-success btn-sm class-user-role" data-username="'+v+'">privileged</button>'
        } else {
          var role_button = '<button type="button" class="btn btn-info btn-sm class-user-role" data-username="'+v+'">restricted</button>'
        }
        var checkbox = '<input type="checkbox" class="rowcheckbox">'
        var remove_button = '<button type="button" class="btn btn-danger btn-sm class-user-remove" data-username="'+v+'">Remove</button>';
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
          registerClassUserDetail();
        },
       "paging":   false,
       "ordering": false,
       "filter": false,
       "info":     false,
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
      registerClassUserDetail();
    }
    });
  }
  function registerClassUserDetail(){
    $(".class-user-role").click(function(e){
      e.preventDefault();
      var user_array = [];
      var new_role = $(this).text() == 'privileged' ? 'restricted' : 'privileged';
      user_array.push($(this).data('username'));
      bulkUserRole($("#class-detail-urn").val(), user_array, new_role);     
    })
    $(".class-user-remove").click(function(e){
      e.preventDefault();
      var user_array = []
      user_array.push($(this).data('username'));
      bulkUserClassRemove($("#class-detail-urn").val(), user_array);
    })
  }
  function insertClassData(urn){
    var details = _.findWhere(class_data, {urn: urn})
    $("#class-detail-urn").val(urn).prop('disabled', true);
    $("#class-detail-name").val(details.name);
    $("#class-detail-description").val(details.description);
  }
  function insertCampaignList(urn){
    var details = _.findWhere(class_data, {urn: urn})
    if ($("#class-detail-campaigns")[0].selectize){
      $("#class-detail-campaigns")[0].selectize.clear();
      $("#class-detail-campaigns")[0].selectize.destroy();
    }
    $("#class-detail-campaigns").selectize({
      persist: false,
      maxItems: null,
      valueField: 'urn',
      labelField: 'name',
      searchField: ['urn', 'name'],
      dropdownParent: "body",
      options: campaign_data,
      items: details.campaigns,
      render: {
          option: function(item, escape) {
              var label = item.name;
              var caption = item.urn;
              return '<div>'+'<h6>'+escape(label)+' <small>'+escape(caption)+'</small></h6></div>';
          }
      },
    });
  }
  function insertClassUserAdd(urn){
    if ($("#class-user-add-token-search")[0].selectize){
      $("#class-user-add-token-search")[0].selectize.clear();
      $("#class-user-add-token-search")[0].selectize.destroy();
    }
    $("#class-user-add-token-search").selectize({
      persist: false,
      maxItems: null,
      valueField: 'username',
      labelField: 'username',
      searchField: ['username'],
      dropdownParent: "body",
      options: usersWithoutClass(urn)
    });
  }
  function deleteClass(urn){
    if(!confirm("Are you sure you want to delete the class: "+urn+"? This cannot be undone!")) return;
      oh.class.delete({class_urn: urn}).done(function(){
        message("Successfully deleted: "+urn+".", "success");
        refreshClass();
      });
  }
  function usersWithoutClass(disable_urn){
    var without_current_class = _.filter(user_data, function(val){
      return _.contains(_.keys(val.classes), disable_urn) ? false : true;
    });
    return without_current_class;
  }
  function bulkUserUpdate(action, state){
    var users = getChecked(user_table);
    var count = (users.length - 1);
    _.each(users, function(u,i){
      var data = {username: u};
      data[action] = state;
      oh.user.update(data).done(function(){
        if (i == count) { //lazy man's promises
          refreshUser();
          message("Successfully updated users", "success");
        }
    });
  });
  }
  function insertUserData(data) {
    $("#user-detail-username").val(data.username);
    $("#user-detail-password").val("");
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
  function deleteUser(user_array){
    var to_delete = user_array.toString();
    if(!confirm("Are you sure you want to delete the following users: "+to_delete+"? This cannot be undone!")) return;
      oh.user.delete({user_list: to_delete}).done(function(){
        message("Successfully deleted users!", "success");
        refreshUser();
      });
  }
  function getChecked(table) {
    var checked_list = [];
    table.$('tr').each(function(index,row){
      var checkbox = $(row).find('input[type=checkbox]');
      var data = table.row($(row)).data();
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