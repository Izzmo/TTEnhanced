/**
 * NOTES:
 * notification popup: http://fiddle.jshell.net/qmxqW/
 */

(function() {  
  if(typeof tte != 'undefined' && typeof tte.ui != 'undefined')
    turntable.removeEventListener("message", tte.ui.listener);
  
  tte = {
    ttObj: null,
    attempts: 0,
    timers: [],
    timerHover: null,
    downvoters: [],
    spotSaving: {
      spot_saving: false,
      spot_attempts: [],
      boot_msg: 'Please stop trying to get on deck, the spot is reserved!',
      spot_users: []
    },
    settings: {
      boot_linkers: true
    },
    isAfk: function(uid) { 
     for(var prop in tte.timers) {
        if(tte.timers[prop].userid == uid) {
          var afk = (tte.timers[prop].time <= ((new Date().getTime()) - 600000));
          tte.timers[prop].time = new Date().getTime();
          return afk;
        }
      }
      // person doesn't exist in array, so add them
      tte.timers.push({userid: uid, time: new Date().getTime()});
      return false;
    },
    getAfkTime: function(uid) {
      var t = (new Date()).getTime();
      for(var prop in tte.timers) {
        if(tte.timers[prop].userid == uid) {
          t = tte.timers[prop].time;
          break;
        }
      }
      var seconds = ((new Date()).getTime() - t) / 1000,
          minutes = seconds / 60,
          hours = minutes / 60,
          time = "";
      if(hours >= 1) {
        hours = Math.round(hours);
        if(hours < 10)
          time += "0";
        time += hours + ":";
      }
      else
        time += "00:";

      if(minutes >= 1) {
        minutes = parseInt(minutes % 60);
        if(minutes < 10)
          time += "0";
        time += minutes + ":";
      }
      else
        time += "00:";

      if(seconds >= 1) {
        seconds = parseInt(seconds % 60);
        if(seconds < 10)
          time += "0";
        time += seconds;
      }
      else
        time += "00";

      return time;
    },
    sendMsg: function(msg) {
      turntable.socket.send(JSON.stringify({
        api: "room.speak",
        roomid: TURNTABLE_ROOMID,
        text: msg,
        msgid: turntable.messageId++,
        clientid: turntable.clientId,
        userid: turntable.user.id,
        userauth: turntable.user.auth
      }));
    },
    sendPm: function(userid, msg) {
      turntable.socket.send(JSON.stringify({
        api: "pm.send",
        receiverid: userid,
        text: msg,
        msgid: turntable.messageId++,
        clientid: turntable.clientId,
        userid: turntable.user.id,
        userauth: turntable.user.auth
      }));
    },
    eventManager: {
      event: document.createEvent("Event"),
      messages: [],
      queue: function(params, callback) {
        var msgId = tte.eventManager.messages.push(callback),
            data = $.extend({'msgId': msgId}, params);
        $('#tteui-msg').html(JSON.stringify(data))[0].dispatchEvent(tte.eventManager.event);
      },
      init: function() {
        // setup event handler
        tte.eventManager.event.initEvent("tteEventWeb", true, true);
        $('#tteui-msg').bind('tteEventExt', function() {
          var data = JSON.parse($(this).html()),
              func = tte.eventManager.messages[data.msgId-1];
          console.log('Received from extension: ');
          console.log(data);
          if(func != undefined)
            func(data);
          delete tte.eventManager.messages[data.msgId-1];
        });
      }
    },
    init: function() {
      tte.eventManager.init();
    }
  };

  tte.utils = {
    getNameByUserId: function(userId) {
      return tte.ttObj.users[userId.toString()].name;
    },
    getUserIdByName: function(name) {
      var users = tte.ttObj.users;
      for(var i in users) {
        if(users[i].name.toLowerCase() == $.trim(name.toLowerCase()))
          return users[i].userid;
      }
      return 0;
    },
    isNumeric: function(vTestValue)
    {
      // put the TEST value into a string object variable
      var sField = new String($.trim(vTestValue));
      
      // check for a length of 0 - if so, return false
      if(sField.length==0) {return false;}
      else if(sField.length==1 && (sField.charAt(0) == '.' || sField.charAt(0) == ',' || (sField.charAt(0) == '-'))) {return false;}
      
      // loop through each character of the string
      for(var x=0; x < sField.length; x++) {
        // if the character is < 0 or > 9, return false (not a number)
        if((sField.charAt(x) >= '0' && sField.charAt(x) <= '9') || sField.charAt(x) == '.' || sField.charAt(x) == ',' || (sField.charAt(x) == '-' && x==0)) { /* do nothing */ }
        else { return false; }
      }
      
      // made it through the loop - we have a number
      return true;
    }
  };

  tte.ui = {
    settings: {
      animations: true,
      favorites: [],
      notifierKeywords: [],
      displayType: 0
    },
    version: '3.0.7',
    newUpdatesMsg: '<ul>'
                  +'<li>Bug Fix: Snag counter was not incrementing.</li>'
                  +'<li>Bug Fix: Stop Animations not working properly.</li>'
                  +'</ul>',
    upvotes: 0,
    downvotes: 0,
    snags: 0,

    listener: function(d) {
      switch(d.command) {
        case 'snagged':
          var $snags = tte.ui.votes.find('div.snags');
          $snags.html(++tte.ui.snags);
          tte.isAfk(d.senderid);

          // Update Snag count
          tte.ui.updateVoteDisplays(tte.ui.upvotes,tte.ui.downvotes,tte.ui.snags,-1);
          break;
          
        case 'update_votes':
          tte.ui.votes.find('div.awesomes').html(d.room.metadata.upvotes);
          tte.ui.votes.find('div.lames').html(d.room.metadata.downvotes);
          
          // Get upvotes count
          tte.ui.upvotes = d.room.metadata.upvotes;

          //var $user = $('#' + d.room.metadata.votelog[0][0]);
          //if(!$user.length)
            //$user = guestListAddUser(d.room.metadata.votelog[0][0]);
          if(d.room.metadata.votelog[0][1] == "up") {
            $user.addClass('voteup').removeClass('votedown');
            var pos = $.inArray(d.room.metadata.votelog[0][0], tte.downvoters)
            if(pos >= 0)
              delete tte.downvoters[pos];

            // Reconcile downvotes
            tte.ui.downvotes = d.room.metadata.downvotes;
          }
          else {
            $user.addClass('votedown').removeClass('voteup');
            if($.inArray(d.room.metadata.votelog[0][0], tte.downvoters) == -1)
              tte.downvoters.push(d.room.metadata.votelog[0][0]);

            // Update downvote tally
            tte.ui.downvotes += 1;
          }
          tte.isAfk(d.room.metadata.votelog[0][0]);
          break;
          
        case 'newsong':
          tte.ui.votes.find('div.awesomes, div.lames, div.snags').html(0);
          tte.downvoters = [];
          tte.ui.guestList();
          tte.ui.updateSongCount();

          // Reset Vote Counts
          tte.ui.upvotes = 0;
          tte.ui.downvotes = 0;
          tte.ui.snags = 0;
          
          // Send notification
          tte.ui.sendNotification(tte.ttObj.currentSong.djname + ' started playing:', tte.ttObj.currentSong.metadata.song + ' by ' + tte.ttObj.currentSong.metadata.artist);

          break;
          
        case 'registered':
          tte.ui.guestListAddUser(d.user[0]);
          $('#' + d.user[0].userid).addClass('tte-joined');
          setTimeout(function() { var userid = d.user[0].userid; if(!$('#' + userid).hasClass('tte-joined')) return; $('#' + userid).removeClass('tte-joined'); }, 5000);
          $("span#totalUsers").text(tte.ui.numUsers());
          tte.timers.push({userid: d.user[0].userid, time: new Date().getTime()});
          break;
          
        case 'deregistered':
          $('#' + d.user[0].userid).addClass('left');
          setTimeout(function() {
            var userid = d.user[0].userid;
            
            if(!$('#' + userid).hasClass('left')) return;
            
            tte.ui.guestListRemoveUser(userid);
            $("span#totalUsers").text(tte.ui.numUsers());
            for(var prop in tte.timers) {
              if(tte.timers[prop].userid == userid) {
                delete tte.timers[prop];
                break;
              }
            }
          }, 5000);
          break;
          
        case 'pmmed':
          tte.ui.sendNotification('PM Notification', turntable.buddyList.pmWindows[d.senderid].otherUserName + ': ' + d.text);
          tte.isAfk(d.senderid);
          break;
          
        case 'speak':
          var list = tte.ttObj.users[window.turntable.user.id].name;
          $.each(tte.ui.settings.notifierKeywords, function(i, v) {
            if(typeof v != 'undefined' && v.length > 0)
              list += '|' + v;
          });
          if(d.text.search(new RegExp(list, 'i')) >= 0)
            tte.ui.sendNotification('Chat Notification', d.name + ': ' + d.text);
          if(tte.settings.boot_linkers && d.text.search(/(tt|turntable)\.fm\/(?!settings|jobs|lobby|getfile|static|down|about|terms|privacy|copyright)([a-zA-Z0-9\-\_]+)\/?/ig) >= 0 && tte.ttObj.isMod() && !tte.ttObj.isMod(d.userid)) {
            tte.socket({
              api: 'room.boot_user',
              roomid: TURNTABLE_ROOMID,
              target_userid: d.userid,
              reason: 'Please do not link to other turntable rooms.'
            });
          }
          tte.isAfk(d.userid);
          break;
          
        case 'rem_dj':
          tte.ui.guestListAddUser(d.user[0]);
          
          // Send notification
          tte.ui.sendNotification('DJ Spot Available!', d.user[0].name + ' dropped from the decks.');
          break;
          
        case 'add_dj':
          tte.ui.guestListAddUser(d.user[0]);
          
          if(tte.ttObj.isMod() && tte.spotSaving.spot_saving) {
            var allOnDeck = 0;
            var total = tte.spotSaving.spot_users.length;
            $.each(tte.spotSaving.spot_users, function(i, v) {
              var uid = '';
              $.each(tte.ttObj.users, function(i2, v2) {
                if(v2.name.toLowerCase() == v.toLowerCase())
                  uid = v2.userid;
              });

              if(uid == '')
                total--; //person not in the room, so don't take him into account'
              else {
                if($.inArray(uid, tte.ttObj.djids) >= 0)
                  allOnDeck++;
              }
            });
            if(allOnDeck == total)
              tte.spotSaving.spot_saving = false;
            else {
              if($.inArray(d.user[0].name.toLowerCase(), tte.spotSaving.spot_users) < 0) {
                if(allOnDeck != total) {
                  tte.spotSaving.spot_attempts.push(d.user[0].userid);
                  var count = 0;
                  $.each(tte.spotSaving.spot_attempts, function(i, v) {
                    if(v == d.user[0].userid) count++;
                  });
                  if(count > 2) { 
                    tte.socket({
                      api: 'room.boot_user',
                      roomid: TURNTABLE_ROOMID,
                      target_userid: d.user[0].userid,
                      reason: tte.spotSaving.boot_msg
                    });
                  }
                  else {
                    tte.callback('remove_dj', d.user[0].userid);
                    tte.sendMsg(':exclamation:Sorry ' + d.user[0].name + ', that spot is reserved!');
                  }
                }
                else {
                  tte.spotSaving.spot_attempts = [];
                  tte.spotSaving.spot_saving = false;
                }
              }
            }
          }
          break;
          
        case 'new_moderator':
          tte.ui.guestList();
          if (d.userid == window.turntable.user.id)
            tte.ui.addModTools();
          break;
          
        case 'rem_moderator':
          tte.ui.guestList();
          if (d.userid == window.turntable.user.id)
            tte.ui.remModTools();
          break;
          
        case 'update_user':
          if(d.fans !== undefined) {
            // Don't want to reload the guest list for every single time someone unfans or fans someone in the room. So check and see what user it is.. if we are to fan or unfan them based on if they have a heart image or not (no other way to reliably tell without attaching an event handler to every button that has a "Become a Fan" on it.
            var $g = $('div.guests #' + d.userid + ' div.icons img[alt="Fan"]');
            if(($g.length && d.fans == -1) || (!$g.length && d.fans == 1))
              tte.ui.guestList();
          }
          if(d.avatarid !== undefined) {
            var $img = $('div.guests #' + d.userid + ' div.guestAvatar img');
            $img.attr('src', $img.attr('src').replace(/\/avatars\/[0-9]{1,4}\//, '/avatars/' + d.avatarid + '/'));
          }
          break;
          
        case 'playlist_complete':
          // catch adding a song to add the to bottom
          tte.ui.addSongToBottom();
          break;
      }
    },

    override_set_dj_points: function(points) {
      setTimeout(function(){tte.ui.updateVoteDisplays(tte.ui.upvotes,tte.ui.downvotes,tte.ui.snags,points);},250);
    },

    updateVoteDisplays: function(upvotes,downvotes,snags,points) {
      if(points < 0) {points = Number(tte.ttRoomObjs.current_dj[3].html().split(" ")[0].replace(',',''));}
      var suffix = " points";
      suffix += "<br/>+" + upvotes.toString();
      suffix += " / -" + downvotes.toString();
      suffix += " / &#9829;" + snags.toString();

      // Dj Display
      if(tte.ttRoomObjs.current_dj)
      {
        tte.ttRoomObjs.current_dj[3].show();
        tte.ttRoomObjs.current_dj[3].html(tte.ttRoomObjs.commafy(points) + suffix);
        tte.ttRoomObjs.current_dj[4].points = points;
      }

      // Song List Display
      if($('div.songlog:first div.song:first div.tteTrackHistoryVotes:first').length <= 0)
      {
        var content = $('<div class="tteTrackHistoryVotes"> </div>');
        content.css({
          fontSize:"10px",
          textAlign:"center"
        });
        $('div.songlog:first div.song:first div.songinfo:first').append(content);
      }
      $('div.songlog:first div.song:first div.tteTrackHistoryVotes:first').html('+' + upvotes + '/-' + downvotes + '<br/>&#9829; ' + snags);
    },
    numUsers: function() {
      var count = 0;
      for(var prop in tte.ttObj.users)
        count++;
      return count;
    },
    userSort: function (j, i) {
      var h = j.name.toLowerCase(),
          k = i.name.toLowerCase();
      return (k > h) ? -1 : (k < h) ? 1 : 0;
    },
    guestList: function () {
      return;
      
      var supers = [],
          mods = [],
          djs = [],
          fans = [],
          users = [],
          g = $(".guest-list-container .guests");
      
      // get each type
      for (var f in tte.ttObj.users) {
        if(tte.ttObj.isDj(f))
          djs.push(tte.ttObj.users[f]);
        else if(tte.ttObj.isSuperuser(f))
          supers.push(tte.ttObj.users[f]);
        else if(tte.ttObj.isMod(f))
          mods.push(tte.ttObj.users[f]);
        else if(tte.ttObj.users[f].fanof)
          fans.push(tte.ttObj.users[f]);
        else
          users.push(tte.ttObj.users[f]);
      }

      var c = g.find(".guest.selected").data("id");
      g.find("div").remove();

      // sort
      tte.ui.guestListAddUsers(g, 'super', supers.sort(tte.ui.userSort));
      tte.ui.guestListAddUsers(g, 'mod', mods.sort(tte.ui.userSort));
      tte.ui.guestListAddUsers(g, 'dj', djs.sort(tte.ui.userSort));
      tte.ui.guestListAddUsers(g, 'fan', fans.sort(tte.ui.userSort));
      tte.ui.guestListAddUsers(g, 'user', users.sort(tte.ui.userSort));
      //tte.ui.guestListAddUsers(g, 'user', $.merge(fans.sort(tte.ui.userSort), users.sort(tte.ui.userSort)));
      
      if(fans.length > 0)
        $('#desc-user > div.desc').hide();
      
      $.each(tte.ttObj.upvoters, function(i, v) {
        g.find('#' + v).addClass('voteup');
      });
      
      $("span#totalUsers").text(tte.ui.numUsers());
    },
    guestListAddUsers: function(obj, type, userList) {
      return;
      
      var title = '',
          html = '';
          
      switch(type) {
        case 'super':
          title = 'Super Users';
          break;
        
        case 'mod':
          title = 'Moderators';
          break;
          
        case 'dj':
          title = 'DJs';
          break;
          
        case 'fan':
          title = 'Users';
          break;
          
        default:
          title = 'Users';
          break;
      }
      
      groupContainer = $('<div id="desc-' + type + '" ' + ((!userList.length) ? 'style="display:none;"' : '') + '></div>');
      groupHeader = $('<div class="desc black-right-header"' + ((type == 'super') ? ' style="display: none;"' : '') + '><div class="desc-inner header-text">' + title + '</div></div>');
      groupContainer.append(groupHeader);
      $.each(userList, function(i, v) {
        groupContainer.append(tte.ui.guestListGetUserHtml(type, v));
      });
      obj.append(groupContainer);
    },
    guestListAddUser: function(user) {
      return;
      
      var type, $s;
      if(tte.ttObj.isDj(user.userid))
        type = 'dj';
      else if(tte.ttObj.isSuperuser(user.userid))
        type = 'super';
      else if(tte.ttObj.isMod(user.userid))
        type = 'mod';
      else if(user.fanof) {
        type = 'fan';
        $('#desc-user > div.desc').hide();
      }
      else
        type = 'user';
      
      $('#' + user.userid).remove();
      
      $s = $('#desc-' + type);
      var text = tte.ui.guestListGetUserHtml(type, user),
          found = undefined;
      $s.find('div.guest').each(function() {
        var $this = $(this);
        if(tte.ui.userSort(user, {name: $this.find('div.guestName').html()}) <= 0) {
          found = $this;
          return false;
        }
        return true;
      });
      if(found == undefined)
        $s.append(text);
      else
        found.before(text);
      $s.show();
      return text;
    },
    guestListRemoveUser: function(uid) {
      return;
      
      var $e = $('#' + uid);
      if($e.parent().find('div.guest').length == 1)
        $e.parent().hide();
      $e.remove();
    },
    guestListGetUserHtml: function(type, user) {
      return;
      
      var icons = '';
      if(tte.ttObj.isSuperuser(user.userid))
        icons += '<img src="http://static.turntable.fm.s3.amazonaws.com/images/room/superuser_icon.png" alt="Super User" />';
      else if(tte.ttObj.isMod(user.userid))
        icons += '<img src="http://static.turntable.fm.s3.amazonaws.com/images/room/mod_icon.png" alt="Moderator" />';
      
      var vote = '';
      if($.inArray(user.userid, tte.downvoters) >= 0)
        vote = 'votedown';
      else if($.inArray(user.userid, tte.ttObj.upvoters) >= 0)
        vote = 'voteup';
      
      return  $('<div class="guest ' + type + ' ' + vote + ' ' + ((user.fanof && type == user) ? 'fan' : '') + '" id="' + user.userid + '">'
            + '<div class="guestAvatar"><img src="https://s3.amazonaws.com/static.turntable.fm/roommanager_assets/avatars/' + user.avatarid + '/scaled/55/headfront.png" height="20" alt="" /></div>'
            + '<div class="icons">' + icons + ((tte.ttObj.users[user.userid].fanof) ? '<img src="http://www.pinnacleofdestruction.net/tt/images/heart_small.png" alt="Fan" />' : '') + '</div>'
            + '<div class="idletime"></div>'
            + '<div class="guestName">' + user.name + '</div>'
            + '</div>')
            .bind('click', function() {
              var $this = $(this),
                  l = Room.layouts.guestOptions(tte.ttObj.users[$this.attr('id')], tte.ttObj);
              
              delete l[3]; // remove the arrow from showing
              
              l[2].push([
                'a.guestOption.option',
                {
                  event: {click: function(e) {
                    e.preventDefault();
                    tte.eventManager.queue({api: 'getNote', userid: $this.attr('id')}, function(response) {
                      var $html = $(util.buildTree(
                        ["div.modal", {},
                          ["div.close-x", {event: {click: util.hideOverlay}}],
                          ["h1", "Set User Note"],
                          ["br"],
                          ["div", {}, "Enter any information you would like about this user below."],
                          ["br"],
                          ["textarea#userNoteField.textarea", {maxlength: 400} ],
                          ["br"], ["br"],
                          ["div.ok-button.centered-button", {event: {click: function() {
                                  var val = $('#userNoteField').val(), uid = $this.attr('id');
                                  tte.eventManager.queue({api: 'setNote', userid: uid, note: val});
                                  util.hideOverlay();
                                }
                              }
                            }
                          ]
                        ]
                      ));
                      $html.find('#userNoteField').val(response.note);
                      util.showOverlay($html);
                    });
                    $(this).parent().remove();
                  }},
                  href: '#'
                },
                'Set Note'
              ],
              ['a.guestOption.option',
                {
                  event: {click: function(e) {
                    e.preventDefault();
                    window.open('http://ttstats.info/user/' + $this.attr('id'), '_newtab');
                    $(this).parent().remove();
                  }},
                  href: '#'
                },
                'Look-up on ttStats'
              ]);
              
              if(tte.ttObj.isDj($this.attr('id'))) {
                // remove "Remove DJ" to end of the list
                var rdj = l[2].splice(5, 1);
                l[2].push(rdj[0]);
              }
              
              var c = $(util.buildTree(l)).css({
                top: $this.offset().top + 'px',
                left: $this.offset().left + 'px',
                right: 'auto'
              });
              $('body').append(c);
            })
            .bind('mouseenter', function() {
              $this = $(this);
              $this.find('div.idletime').html(tte.getAfkTime($this.attr('id'))).show();
              $this.find('div.icons').hide();
              clearInterval(tte.timerHover);
              tte.timerHover = setInterval(function() {
                $this.find('div.idletime').html(tte.getAfkTime($this.attr('id')));
              }, 1000);
            })
            .bind('mouseleave', function() {
              $(this).find('div.idletime').hide();
              $(this).find('div.icons').show();
              clearInterval(tte.timerHover);
            });
    },
    appendChatMessage: function (f, a, h, j) {
      var e = this.nodes.chatLog;
      var g = (e.scrollTop + $(e).height() + 20 >= e.scrollHeight);
      var b = util.buildTree(Room.layouts.chatMessage);
      var i = this;
      $(b).find(".speaker").text(a).click(function (e) {
        if(tte.ui.settings.showChatAvatarTooltip)
          tte.ttRoomObjs.toggle_tipsy(f);
        var l = Room.layouts.guestOptions(tte.ttObj.users[f], tte.ttObj);
        
        delete l[3]; // remove arrow
              
        l[2].splice(4, 0, [
          'a.guestOption',
          {
            event: { click: function(e) {
              e.preventDefault();
              tte.eventManager.queue({ api: 'getNote', userid: f }, function(response) {
                var $html = $(util.buildTree(
                  ["div.modal", {},
                    ["div.close-x", { event: { click: util.hideOverlay } } ],
                    ["h1", "Set User Note"],
                    ["br"],
                    ["div", {}, "Enter any information you would like about this user below."],
                    ["br"],
                    ["textarea#userNoteField.textarea", {maxlength: 400} ],
                    ["br"], ["br"],
                    ["div.ok-button.centered-button", {
                        event: {
                          click: function() {
                            var val = $('#userNoteField').val();
                            tte.eventManager.queue({api: 'setNote', userid: f, note: val});
                            util.hideOverlay();
                          }
                        }
                      }
                    ]
                  ]
                ));
                $html.find('#userNoteField').val(response.note);
                util.showOverlay($html);
              });
              $('div.guestOptionsContainer').remove();
            }},
            href: '#'
          },
          'Set Note'
        ]);
        
        // add ttStats look-up option
        l[2].splice(3, 0, ['a.guestOption',
          {
            event: {click: function(e) {
              e.preventDefault();
              window.open('http://ttstats.info/user/' + f, '_newtab');
              $(this).parent().remove();
            }},
            href: '#'
          },
          'Look-up on ttStats'
        ]);
        
        if(tte.ttObj.isDj(f)) {
          // remove "Remove DJ" to end of the list
          var rdj = l[2].splice(7, 1);
          l[2].push(rdj[0]);
        }
              
        var c = $(util.buildTree(l)).css({
          top: $(this).offset().top + 'px',
          left: $(this).offset().left + 'px',
          right: 'auto'
        });
        $('body').append(c);
      });
      
      // bug in turntable.fm where it will randomly clear all users from the room and will cause this method to error out
      if(!(window.turntable.user.id in tte.ttObj.users)) return;
      
      var list = tte.ttObj.users[window.turntable.user.id].name,
          c = $(b).find(".text");
      $.each(tte.ui.settings.notifierKeywords, function(i, v) {
        if(v != undefined && v.length > 0)
          list += '|' + v;
      });
      if(h.search(new RegExp(list, 'i')) >= 0)
        $(b).addClass('mention');
      
      h = util.stripComboDiacritics(h);
      if (h.length > 446) {
        c.attr("title", h.substr(0, 2) == ": " ? h.substr(2) : h);
        h = h.substr(0, 440) + "...";
      }
      c.html(util.messageFilter(h));
      if (j)
        $(b).addClass(j);
      $(e).append(b);
      if (g)
        e.scrollTop += 9001;
      var d = $(e).find(".message");
      if (d.length > 500)
        d.slice(0, 2).remove();
    },
    updateSongCount: function() {
      var count = 0;
      for(fid in turntable.playlist.songsByFid)
        count++;
      $('#totalSongs').html(count);
      return count;
    },
    sendNotification: function(title, text) {
      if(tte.ui.settings.notifications != 0 && $('html').hasClass('blur') && window.webkitNotifications.checkPermission() == 0) {
        var n = window.webkitNotifications.createNotification('', title, text);
        n.ondisplay = function() {setTimeout(function() {n.cancel()}, 10000);};
        //n.onclose = function() {  };
        n.show();
      }
    },
    toggleAnimations: function() {
      if(tte.ui.settings.animations) {
        tte.ui.settings.animations = false;
        tte.eventManager.queue({api: 'settings', code: 'set', settings: {animations: false}});
        tte.ui.setAnimations(false);
      }
      else {
        tte.ui.settings.animations = true;
        tte.eventManager.queue({api: 'settings', code: 'set', settings: {animations: true}});
        tte.ui.setAnimations(true);
      }
    },
    setAnimations: function(on) {
      if(on) {
        $('#tte-settings-menu-animations-icon').css({backgroundImage: 'url(http://www.pinnacleofdestruction.net/tt/images/check.png)'});
        tte.ttRoomObjs.addListener = tte.ttRoomObjs.__addListener;
        tte.ttObj.addListener = tte.ttObj.__addListener;
        delete tte.ttRoomObjs.__addListener;
        delete tte.ttObj.__addListener;
        for(var user in tte.ttObj.users)
          tte.ttRoomObjs.addListener(tte.ttObj.users[user]);
      }
      else {
        $('#tte-settings-menu-animations-icon').css({backgroundImage: 'url(http://www.pinnacleofdestruction.net/tt/images/cross.png)'});
        for(var user in tte.ttObj.users)
          tte.ttRoomObjs.removeListener(tte.ttObj.users[user]);
        tte.ttRoomObjs.__addListener = tte.ttRoomObjs.addListener;
        tte.ttObj.__addListener = tte.ttObj.addListener;
        tte.ttRoomObjs.addListener = function() {return;}
        tte.ttObj.addListener = function() {return;}
      }
    },
    buddyListBuddy: function(d, g, f) {
      var b = ("roomName" in d && !f) ? ["div.room", { }, d.roomName] : "";
      var a = function() {
        d.fanof = true;
        var l = Room.layouts.guestOptions(d, tte.ttObj);
        delete l[3]; // delete arrow
        l[2].splice(2, 0, l[2].pop());
        var callback = l[2][2][1].event.click.prototype.constructor;
        l[2][2][1].event.click = function() {
          turntable.buddyList.toggle();
          var fcn = eval(callback);
          fcn();
        }
        // now remove unwanted options
        $.each(l[2], function(i, v) {
          if(i < 2) return;
          if(v[2] == "Make a Moderator" || v[2] == "Remove Moderator" || v[2] == "Boot User")
            delete l[2][i];
        });
        // remove Send Private Message and re-add (for some reason TT changed their code and now will refresh the page when clicked)
        //delete l[2][0];
        l[2].splice(2, 1, Room.layouts.guestOption("Send Private Message", function() { turntable.buddyList.room.handlePM({ senderid: d.userid }, true); }));
        // add Go To Room item
        l[2].splice(4, 0, ['a.guestOption.option',
            {
              event: {click: function(e) {
                e.preventDefault();
                window.open('http://ttstats.info/user/' + d.userid, '_newtab');
                $(this).parent().remove();
              }},
              href: '#'
            },
            'Look-up on ttStats'
          ],
          ["a#" + d.userid + ".guestOption.option", {
            event: {'click': function(e) {
              e.preventDefault();
              turntable.setPage(d.roomShortcut, d.roomId);
              $('div.guestOptionsContainer').remove();
              turntable.buddyList.toggle();
          }}, href: '#'}, "Go To Room"],
          ['a.guestOption.option',
            {
              event: {click: function(e) {
                e.preventDefault();
                tte.eventManager.queue({api: 'getNote', userid: d.userid}, function(response) {
                  var $html = $(util.buildTree(
                    ["div.modal", {},
                      ["div.close-x", {event: {click: util.hideOverlay}}],
                      ["h1", "Set User Note"],
                      ["br"],
                      ["div", {}, "Enter any information you would like about this user below."],
                      ["br"],
                      ["textarea#userNoteField.textarea", {maxlength: 400} ],
                      ["br"], ["br"],
                      ["div.ok-button.centered-button", {event: {click: function() {
                              var val = $('#userNoteField').val();
                              tte.eventManager.queue({api: 'setNote', userid: d.userid, note: val});
                              util.hideOverlay();
                            }
                          }
                        }
                      ]
                    ]
                  ));
                  $html.find('#userNoteField').val(response.note);
                  util.showOverlay($html);
                });
                $('div.guestOptionsContainer').remove();
              }},
              href: '#'
            },
            'Set Note'
          ]);
        
        // add favorite item
        if($.inArray(d.userid, tte.ui.settings.favorites) >= 0) {
          l[2].splice(4, 0, ["a#" + d.userid + ".guestOption.option", {event: {'click': function(e) {
            e.preventDefault();
            var userid = $(this).attr('id');
            tte.eventManager.queue({api: 'favorite.remove', 'userid': userid});
            tte.ui.settings.favorites.splice($.inArray(userid, tte.ui.settings.favorites), 1);
            $('div.guestOptionsContainer').remove();
            $('#buddyList #bl' + $(this).attr('id')).removeClass('favorite');
            window.turntable.fetchBuddyPresence();
          }}, href: '#'}, "Un-Favorite User"]);
        }
        else {
          l[2].splice(4, 0, ["a#" + d.userid + ".guestOption.option", {event: {'click': function(e) {
            e.preventDefault();
            var userid = $(this).attr('id');
            tte.eventManager.queue({api: 'favorite.add', 'userid': userid});
            tte.ui.settings.favorites.push(userid);
            $('div.guestOptionsContainer').remove();
            $('#buddyList #bl' + $(this).attr('id')).addClass('favorite').find('div.name').append(' \u2605').end().prependTo($('#buddyList'));
          }}, href: '#'}, "Favorite User"]);          
        }
  
        var c = $(util.buildTree(l)).css({
          top: $(this).offset().top + 'px',
          left: $(this).offset().left + 'px',
          right: 'auto'
        });
        $('body').append(c);
      };
      
      var e = (f) ? "overflowListItem" : "buddy" + d.userid;
      var c;
      if("fbid" in d) {
        c = "https://graph.facebook.com/" + d.fbid + "/picture";
      }
      else {
        if("twitterid_lower" in d) {
          c = "https://api.twitter.com/1/users/profile_image?screen_name=" + d.twitterid_lower + "&size=normal";
        }
        else {
          c = "https://s3.amazonaws.com/static.turntable.fm/roommanager_assets/avatars/" + d.avatarid + "/scaled/55/headfront.png";
        }
      }
      return ["li#bl" + d.userid + "#" + e + ".buddy", {
          event: {
            click: a,
            mouseover: function() {
              $(this).addClass("hover");
            },
            mouseout: function() {
              $(this).removeClass("hover");
            }
          }
        },
        ["div.avatar", { }, ["img", {
          src: c,
          height: "20"
        }]],
        ["div.user", { }, ["div.name", { }, (($.inArray(d.userid, tte.ui.settings.favorites) >= 0) ? (d.name + ' \u2605') : d.name)],b],
        ["div##status" + d.userid + ".status." + d.status]
      ];
    },
    setDisplay: function(type, change) {
      var $outer = $('#outer'),
          $turntable = $('#turntable'),
          $roomView = $turntable.find('div.roomView'),
          $room = $($turntable.find('div.roomView > div')[1]),
          $topPanel = $('#top-panel'),
          $right = $('#right-panel'),
          height = $room.height(),
          width = $room.width(),
          $chatContainer, $userContainer, $playlist, $view;
          
      if(height <= 0 || width <= 0) {
        setTimeout(function() { var t = type, c = change; window.izzmo.ui.setDisplay(t, c); }, 2000);
        return;
      }

      switch(type) {
        case -1:
          // remove share buttons only if in this view
          $topPanel.find('div.share-on').hide();
          if(change) {
            // rebind scroll events
            $(".chatHeader").mousedown(tte.ttObj.chatResizeStart);
            
            // move chat window back inside right-panel container
            $chatContainer = $roomView.find('div.chat-container').css({top: '258px', left: '', 'height': '345px'});
            $chatContainer.find('div.messages').css({'height': '283px'});
            $chatContainer.appendTo($right);
            
            // update user list
            $userContainer = $roomView.find('div.guest-list-container').css({top: '258px', left: '', 'height': '345px'});
            $userContainer.find('div.guests').css({'height': '283px'});
            $userContainer.appendTo($right);
            
            // update sizes on DJ Queue window
            $playlist = $('#playlist');
            $view = $playlist.find('div.mainPane');
            $playlist.height(259);
            $view.height(259);
            $view.find('div.songlist').height(166);
            $playlist.find('div.chatBar').remove();
          }
          break;
          
        case 0:
          // 3 Column
          if(change)
            tte.ui.setDisplay(-1, true);
          
          // unbind default events
          $(".chatHeader").unbind('mousedown');
          
          // move chat window outside panel container
          $chatContainer = $right.find('div.chat-container').css({top: '99px', left: width+'px', 'height': height+'px'});
          $chatContainer.find('div.messages').css({'height': (height-62)+'px'});
          $chatContainer.appendTo($roomView);

          // update sizes on DJ Queue window
          $playlist = $('#playlist');
          $view = $playlist.find('div.mainPane');
          $playlist.height(height-1).parent().parent().height(height-1);
          $view.height(height-26-36);
          $('#songs').height(height-26-36-38);
          if(!$('#totalSongs').length) {
            $playlist.append('<div class="chatBar"><div class="guestListSize"><span id="totalSongs">0</span> songs in your queue.</div></div>');
            if(tte.ui.updateSongCount() == 0)
              setTimeout(function() {tte.ui.updateSongCount();}, 10000);
          }

          // update user list
          $userContainer = $right.find('div.guest-list-container').css({top: '99px', left: (width+307)+'px', 'height': height+'px'});
          $userContainer.find('div.guests').css({'height': (height-62)+'px'});
          $userContainer.appendTo($roomView);
          break;
          
        case 1:
          // Queue & Guest list stacked
          
          if(change)
            tte.ui.setDisplay(-1, true);
          
          // unbind default events
          $(".chatHeader").unbind('mousedown');
          
          // move chat window outside panel container
          $chatContainer = $right.find('div.chat-container').css({top: '99px', left: width+'px', 'height': height+'px'});
          $chatContainer.find('div.messages').css({'height': (height-62)+'px'});
          $chatContainer.appendTo($roomView);

          // update sizes on DJ Queue window
          $playlist = $('#playlist');
          $view = $playlist.find('div.mainPane');
          $playlist.height(301).parent().parent().height(height);
          $view.height(301-25-36);
          $view.find('div.songlist').height(301-25-68-36);
          if(!$('#totalSongs').length) {
            $playlist.append('<div class="chatBar"><div class="guestListSize"><span id="totalSongs">0</span> songs in your queue.</div></div>');
            if(tte.ui.updateSongCount() == 0)
              setTimeout(function() {tte.ui.updateSongCount();}, 10000);
          }

          // update user list
          $userContainer = $right.find('div.guest-list-container').css({top: '300px', 'height': '302px'});
          $userContainer.find('div.guests').css({'height': (height-301-62)+'px'});
          break;
          
        case 2:
          // Queue & Chat Stacked
          
          if(change)
            tte.ui.setDisplay(-1, true);
          
          // unbind default events
          $(".chatHeader").unbind('mousedown');
          
          // move chat window outside panel container
          $chatContainer = $right.find('div.chat-container').css({top: '300px', 'height': '302px'});
          $chatContainer.find('div.messages').css({'height': (height-301-62)+'px'});

          // update sizes on DJ Queue window
          $playlist = $('#playlist');
          $view = $playlist.find('div.mainPane');
          $playlist.height(301).parent().parent().height(height);
          $view.height(301-25-36);
          $view.find('div.songlist').height(301-25-68-36);
          if(!$('#totalSongs').length) {
            $playlist.append('<div class="chatBar"><div class="guestListSize"><span id="totalSongs">0</span> songs in your queue.</div></div>');
            if(tte.ui.updateSongCount() == 0)
              setTimeout(function() {tte.ui.updateSongCount();}, 10000);
          }

          // update user list
          $userContainer = $right.find('div.guest-list-container').css({top: '99px', left: width+'px', 'height': height+'px'});
          $userContainer.find('div.guests').css({'height': (height-62)+'px'});
          $userContainer.appendTo($roomView);
          break;
      }
      if(type >= 0)
        $topPanel.find('div.share-on').show();
    },
    lastValidCommaIndex: function (a) {
      var c = a.split(",");
      if (c.length > 1) {
        for (var b = c.length - 1; b >= 0; b--) {
          if (c[b].length)
            return (c.slice(0, b).join(",").length + 1);
        }
        if (c[0] == "")
          return 0;
      }
      return -1;
    },
    chooseSuggestedName: function (a, b) {
      if (!b) return;
      if (!a) a = $("#tteSpotSavingUsers")[0];
      if (b[0] == ",") b = b.slice(1);
      var e = a.value.substring(0, a.selectionEnd),
          f = a.value.substring(a.selectionEnd),
          d = tte.ui.lastValidCommaIndex(e);
      if(d < 0) d = 0;
      var c = e.slice(0, d + ((a.value[d] != " ") ? 0 : 1)) + b + ", ";
      $(a).val(c + f);
      a.selectionEnd = c.length;
      tte.ttObj.cancelNameSuggest();
    },
    remModTools: function() {
      $('#tte-settings-menu-moderation').remove();
    },
    addModTools: function() {
      tte.ui.remModTools();
      if(tte.ttObj.isMod()) {
        $('#menuh').find('div.menuItem').last().before('<div id="tte-settings-menu-moderation" class="menuItem">Room Moderation</div>');
        $('#tte-settings-menu-moderation').bind('click', function() {
          var settings = $(util.buildTree(
            ["div#tteui-settings.settingsOverlay.modal", {},
              ["div.close-x", {event: {click: util.hideOverlay}}],
              ["h1", "Room Moderation"],
              ["br"],
              ["div.spots", {} ],
              ["div.save-changes.centered-button", {event: {
                click: function() {
                  tte.spotSaving.spot_saving = ($('#tteui-settings input#tteSpotSaving')[0].checked);
                  tte.spotSaving.boot_msg = $('#tteui-settings input#tteSpotSavingBootMessage').val();
                  tte.settings.boot_linkers = ($('#tteui-settings input#tteBootRoomLinkers')[0].checked);

                  tte.spotSaving.spot_users = [];
                  var usersRaw = $('#tteSpotSavingUsers').val().split(',');
                  for(var i = 0; i < usersRaw.length; i++) {
                    var user = $.trim(usersRaw[i]);
                    if(user != "")
                      tte.spotSaving.spot_users.push(user);
                  }

                  util.hideOverlay();
                }
              }}],
              ["br"]
            ]
          ));

          var spots = settings.find('div.spots:first').append('<div><label for="tteBootRoomLinkers"><span class="tteOptionLabel">Boot Room Linkers?</span> <input type="checkbox" id="tteBootRoomLinkers" value="1"' + ((tte.settings.boot_linkers) ? 'checked' : '') + '><p>If enabled, will automatically boot non-mods from the room for linking to other Turntable.fm rooms.</p></label></div>'
          + '<div><label for="tteSpotSaving"><span class="tteOptionLabel">Save Spots?</span> <input type="checkbox" id="tteSpotSaving" value="1"' + ((tte.spotSaving.spot_saving) ? 'checked' : '') + '><p>Spot saving allows you to moderate who gets up on stage. If enabled, any of the usernames you list below will be allowed on deck, and anyone else who tries to get up will be automatically booted off stage.</p></label></div>'
          + '<div><span class="tteOptionLabel">Usernames:</span> <input type="text" id="tteSpotSavingUsers" /><p>Use commas to separate multiple names. Use two "@"s for names that start with them.</p></div>'
          + '<div><span class="tteOptionLabel">Boot Message:</span> <input type="text" id="tteSpotSavingBootMessage" /></div>');

          // build list
          spots.find('#tteSpotSavingBootMessage').val(tte.spotSaving.boot_msg)
          .end().find('#tteSpotSavingUsers').val(tte.spotSaving.spot_users.join(', '))
          .keydown(function(event) {
            var d = event;
            var a = d.target;
            var b = d.charCode || d.keyCode;
            if (tte.suggestedSpotSavingUser) {
              if (b == 13 || b == 9) {
                tte.ui.chooseSuggestedName(a, tte.suggestedSpotSavingUser);
                return false;
              } else if (b == 38) {
                var f = $(".suggestedName.selected").prev();
                if (f.length)
                  tte.suggestedSpotSavingUser = $(".suggestedName.selected").removeClass("selected").prev().addClass("selected").text();
                return false;
              } else if (b == 40) {
                var c = $(".suggestedName.selected").next();
                if (c.length)
                  tte.suggestedSpotSavingUser = $(".suggestedName.selected").removeClass("selected").next().addClass("selected").text();
                return false;
              } else if (b == 27 || (b == 39 && a.selectionEnd == a.value.length)) {
                tte.ttObj.cancelNameSuggest();
                return false;
              }
            }
            return true;
          });

          tte.suggestedSpotSavingUser = false;
          spots.find('#tteSpotSavingUsers').keyup(function(c) {
            var g = c.target,
                h = c.charCode || c.keyCode,
                j = tte.ttObj;
            if (h == 38 || h == 40 || h == 27 || (h == 39 && g.selectionEnd == g.value.length)) return;
            
            var k = g.value.substring(0, c.target.selectionEnd),
                i = tte.ui.lastValidCommaIndex(k),
                b = k.toLowerCase();
            if (i >= 0)
              b = k.slice(i).toLowerCase();
            
            b = b.trim();
            
            $("#nameSuggest").remove();
            tte.suggestedSpotSavingUser = false;
            var f = [];
            $.each(tte.ttObj.users, function(x) {
              if (this.name.toLowerCase().slice(0, -1).indexOf(b) == 0)
                f.push(this.name);
            });
            if (f.length) {
              window.util.alphabetize(f);
              var a = window.util.buildTree(window.Room.layouts.nameSuggest(f));
              tte.suggestedSpotSavingUser = f[0];
              $("div.settingsOverlay").append(a);
              console.log("appending");
              var d = $("#tteSpotSavingUsers").position();
              $(a).css({
                left: d.left + 1 + "px",
                top: d.top + 1 - $(a).outerHeight() + "px"
              });
              $(".suggestedName").click(function(l) {
                tte.ui.chooseSuggestedName(false, $(l.target).text());
              }).mouseover(function(l) {
                if (!$(this).hasClass("selected")) {
                  tte.suggestedSpotSavingUser = $(this).text();
                  $(".suggestedName.selected").removeClass("selected");
                  $(this).addClass("selected");
                }
              });
            }
          });

          util.showOverlay(settings);
        });
      }
    },
    addSongToBottom: function() {
      return;
      var $songs = $('#songs li.song');
      if(!$songs.length)
        setTimeout(function() { tte.ui.addSongToBottom(); }, 2000);
      else {
        $songs.each(function() {
          var $this = $(this);
          if($this.find('div.goBottom').length) return;
          var $goB = $('<div class="goBottom"></div>').on('click', $.proxy(function(g) {
            var d = $(g.target).closest('.song'), f = d.data('songData').fileId, c = this.attributes.songids.indexOf(f), count = 0;
            for(fid in turntable.playlist.songsByFid) count++;
            window.turntable.playlist.reorder(c, count - 1).done($.proxy(function() {
              this.reorderBySongid(f, count - 1);
              if(window.turntable.playlist.isFiltering)
                window.turntable.playlist.savedScrollPosition = 0;
            }, this));
          }, this));
          $this.find('div.goTop').after($goB);
        });
      }
    }
  };
  
  tte.ui.init = function() {
    /**
    for(var prop in window.turntable) {
      if(window.turntable[prop] != undefined && window.turntable[prop].hasOwnProperty('currentDj'))
        tte.ttObj = window.turntable[prop];
    }
    **/
   tte.ttObj = window.turntable.buddyList.room;
    for(var prop in tte.ttObj) {
      if(prop.indexOf('Callback') >= 0 && prop != 'sampleCallback') {
        tte.callback = tte.ttObj[prop];
        break;
      }
    }
    for(var prop in tte.ttObj) {
      if(tte.ttObj[prop] != undefined && typeof tte.ttObj[prop].floor == 'object')
        tte.ttRoomObjs = tte.ttObj[prop];
    }
    
    if(tte.ttObj === null) {
      if(tte.attempts < 20) {
        tte.attempts++;
        return setTimeout(function() {tte.ui.init()}, 1000);
      }
      else
        return alert('Could not find turntable.fm objects. You should refresh your page and try again.');
    }
    tte.attempts = 0;
    tte.init();

    tte.socket = function (c, a) {
        if (c.api == "room.now") {
            return;
        }
        c.msgid = turntable.messageId;
        turntable.messageId += 1;
        c.clientid = turntable.clientId;
        if (turntable.user.id && !c.userid) {
            c.userid = turntable.user.id;
            c.userauth = turntable.user.auth;
        }
        var d = JSON.stringify(c);
        if (turntable.socketVerbose) {
            LOG(util.nowStr() + " Preparing message " + d);
        }
        var b = $.Deferred();
        turntable.whenSocketConnected(function () {
            if (turntable.socketVerbose) {
                LOG(util.nowStr() + " Sending message " + c.msgid + " to " + turntable.socket.host);
            }
            if (turntable.socket.transport.type == "websocket") {
                turntable.socketLog(turntable.socket.transport.sockets[0].id + ":<" + c.msgid);
            }
            turntable.socket.send(d);
            turntable.socketKeepAlive(true);
            turntable.pendingCalls.push({
                msgid: c.msgid,
                handler: a,
                deferred: b,
                time: util.now()
            });
        });
        return b.promise();
    }
    
    // Add TTEnhanced under TT Logo
    $('#header div.logo').find('#tte-logo').remove().end().append($('<div id="tte-logo">Enhanced</div>'));
    
    // rewrite guest list update function
    //tte.ttObj.__updateGuestList = tte.ttObj.updateGuestList;
    //tte.ttObj.updateGuestList = function() {return;};
    //tte.ui.guestList();
    
    // add votes to top bar
    $('#tte-votes').remove();
    var $bigboard = $('#bigboard'), $lameButton = $('#lame-button'), $awesomeButton = $('#awesome-button'), scale = parseInt($bigboard.width()) / 376;
    tte.ui.votes = $('<div id="tte-votes" style="width: ' + $bigboard.width() + 'px;"><div class="lames" style="top: ' + Math.round(10 * scale) + 'px; left: ' + $lameButton.css('left') + '; width: ' + $lameButton.width() + 'px;">0</div><div class="awesomes" style="right: ' + $awesomeButton.css('right') + '; width: ' + $awesomeButton.width() + 'px; top: ' + Math.round(10 * scale) + 'px;">' + tte.ttObj.upvoters.length + '</div><div class="snags" style="left: ' + Math.round(($bigboard.width() - 24) / 2) + 'px">0</div></div>');
    $bigboard.append(tte.ui.votes);
    if(tte.ttObj.upvoters.length == 0) {
      setTimeout(function() {
        tte.ui.votes.find('div.awesomes').html(tte.ttObj.upvoters.length);
        //tte.ui.guestList();
      }, 2000);
    }

    // override set_dj_points
    //tte.ttRoomObjs.set_dj_points = tte.ui.override_set_dj_points;
    
    turntable.addEventListener("message", tte.ui.listener);
    
    // setup AFK Timers
    for(prop in tte.ttObj.users)
      tte.isAfk(prop);
    
    // update append Chat message function
    //tte.ttObj.appendChatMessage = tte.ui.appendChatMessage;
    
    // add animations button to menu
    $('#tte-settings-menu-animations-icon').remove();
    $('#settings-dropdown li.option').eq(3).after('<li id="tte-settings-menu-animations-icon" class="option" style="background-image: url(http://www.pinnacleofdestruction.net/tt/images/check.png); background-position: 6px 10px; background-repeat: no-repeat; padding-left: 25px;">Animations</li>');
    $('#tte-settings-menu-animations-icon').bind('click', function() {
      tte.ui.toggleAnimations(this);
    });
    
    // add moderation button to menu
    tte.ui.addModTools();
    
    // setup buddy list enhancements
    window.BuddyListPM.layouts.buddyListBuddy = tte.ui.buddyListBuddy;
    //window.turntable.buddyList._updateBuddies = window.turntable.buddyList.updateBuddies;
    window.turntable.buddyList.updateBuddies = function(f) {
      if (f.success == true) {
        $(this.nodes.buddyList).empty();
        var a = [],
            favs = [],
            e = {};
        if (f.rooms && f.rooms.length) {
          for (var g = 0, l = f.rooms.length; g < l; g++) {
            var c = f.rooms[g];
            if (c.length && c[1].length) {
              for (var d = 0, n = c[1].length; d < n; d++) {
                var b = c[1][d];
                b.roomName = c[0].name;
                b.roomShortcut = c[0].shortcut;
                b.roomId = c[0].roomid;
                ($.inArray(b.userid, tte.ui.settings.favorites) >= 0) ? favs.push(b) : a.push(b);
                e[b.userid] = b;
              }
            }
          }
          this.onlineBuddies = {};
          a = util.alphabetize(a, "name");
          favs = util.alphabetize(favs, "name");
          a = favs.concat(a);
          for (g = 0, l = a.length; g < l; g++)
            this.addBuddy(a[g]);
        }
        else
          $(this.nodes.buddyList).append(util.buildTree(BuddyListPM.layouts.noBuddies));
          
        for (g in this.pmWindows) {
          var k = this.pmWindows[g].otherUserId;
          if (k in e)
            this.pmWindows[g].updateStatus(e[k].status, false);
          else {
            var m = (turntable.user.fanOf.indexOf(k) >= 0);
            var h = (turntable.user.buddies.indexOf(k) >= 0);
            if (m || h)
              this.pmWindows[g].updateStatus("offline", false);
          }
        }
      }
      //window.turntable.buddyList._updateBuddies(f);
    }
    window.turntable.fetchBuddyPresence();
    
    // add settings button to menu
    $('#tte-settings-menu-settings').remove();
    $('#settings-dropdown li.option').eq(3).after('<li id="tte-settings-menu-settings" class="option">TTEnhanced</li>');
    $('#tte-settings-menu-settings').bind('click', function() {
      util.buildTree([
        Modal,
        { title: 'TTEnhanced UI Settings', cssClass: 'settingsOverlay', id: 'tteui-settings' },
        ["div.fields", {} ],
        ["div.save-changes.centered-button", {event: {
          click: function() {
            var type = Number($('select#tteUiStyle').val());
            tte.ui.settings.notifications = ($('#tteui-settings input.tteNotifications')[1].checked);
            tte.ui.settings.showChatAvatarTooltip = ($('#tteui-settings input.tteAvatarToolTip')[1].checked);

            if(type != tte.ui.settings.displayType)
              tte.ui.setDisplay(type, true);
            tte.ui.settings.displayType = type;

            tte.ui.settings.notifierKeywords = [];
            var keywordsRaw = $('#tteChatKeywords').val().split(',');
            for(var i = 0; i < keywordsRaw.length; i++) {
              var word = $.trim(keywordsRaw[i])
              if(word != "")
                tte.ui.settings.notifierKeywords.push(word);
            }

            tte.eventManager.queue({api: 'settings', code: 'set', settings: tte.ui.settings});
            tte.modal.hide();
          }
        }}]
      ], tte);      
      
      var fields = tte.modal.$node.find('div.fields:first');
      fields.append('<div><span class="tteOptionLabel">Desktop Notifications</span> <label for="tteNotificationsNo"><input type="radio" name="tteNotifications" id="tteNotificationsNo" class="tteNotifications" value="0" ' + ((tte.ui.settings.notifications) ? '' : 'checked') + '> No / <label for="tteNotificationsYes"><input type="radio" name="tteNotifications" class="tteNotifications" id="tteNotificationsYes" value="1" ' + ((tte.ui.settings.notifications) ? 'checked' : '') + '> Yes</div>');
      fields.append('<div><span class="tteOptionLabel">Avatar Tooltip</span> <label for="tteAvatarToolTipNo"><input type="radio" name="tteAvatarToolTip" id="tteAvatarToolTipNo" class="tteAvatarToolTip" value="0" ' + ((tte.ui.settings.showChatAvatarTooltip) ? '' : 'checked') + '> No / <label for="tteAvatarToolTipYes"><input type="radio" name="tteAvatarToolTip" class="tteAvatarToolTip" id="tteAvatarToolTipYes" value="1" ' + ((tte.ui.settings.showChatAvatarTooltip) ? 'checked' : '') + '> Yes<p>Will show a bubble over the users avatar in the crowd if you click on their username in the chat window (if animations are on).</p></div>');
      fields.append('<div><span class="tteOptionLabel">Command-Line Interface</span> <label for="tteCLINo"><input type="radio" name="tteCLI" id="tteCLINo" class="tteCLI" value="0" ' + ((tte.ui.settings.showChatAvatarTooltip) ? '' : 'checked') + '> No / <label for="tteCLIYes"><input type="radio" name="tteCLI" class="tteCLI" id="tteCLIYes" value="1" ' + ((tte.ui.settings.showChatAvatarTooltip) ? 'checked' : '') + '> Yes<p>Allows you to type slash commands into the chat box such as /awesome, /lame, etc.</p></div>');
      fields.append('<div><span class="tteOptionLabel">Display</span><select name="tteUiStyle" id="tteUiStyle"><option value="-1" ' + ((tte.ui.settings.displayType != -1) ? '' : 'selected') + '>Default</option><option value="0" ' + ((tte.ui.settings.displayType != 0) ? '' : 'selected') + '>3 Columns</option><option value="1" ' + ((tte.ui.settings.displayType != 1) ? '' : 'selected') + '>2 Columns - Queue/Guest Stacked</option><option value="2" ' + ((tte.ui.settings.displayType != 2) ? '' : 'selected') + '>2 Columns - Queue/Chat Stacked</option></select></div>');
      fields.append('<div><span class="tteOptionLabel">Notification Keywords:</span><input type="text" id="tteChatKeywords"/><p>If you would like to receive notifications for keywords other than your own username, you can enter them here -- comma delimited.</p></div>');
      fields.find('#tteChatKeywords').val(tte.ui.settings.notifierKeywords.join(','));
      
      tte.modal.show();
    });
    
    // Auto-Focus on Type
    $('body').on('keypress', function(e) {
      if(e.charCode >= 32 && e.charCode <= 127 && !$('input, select, textarea').is(':focus') && $('div#overlay').css('display') == 'none')
        $('#chat-form textarea').focus();
    });
    
    // add 'To Bottom' button on queue
    tte.ui.addSongToBottom();
    
    // add Turntable.fm Calendar button
    $('#tte-calendar, #tte-calendar-frame').remove();
    $button = $('<div id="tte-calendar"><button type="button" name="" value="">Calendar</button></div>').click(function() {
      $frame = $('#tte-calendar-frame');
      if($frame.length)
        $frame.remove();
      else {
        $('body').append('<iframe id="tte-calendar-frame" src="https://www.google.com/calendar/embed?showTitle=0&amp;showPrint=0&amp;showTabs=0&amp;showCalendars=0&amp;mode=AGENDA&amp;height=400&amp;wkst=1&amp;bgcolor=%23ffffff&amp;src=r45malsboglaloqguqve4n375o%40group.calendar.google.com&amp;color=%232F6309&amp;ctz=America%2FChicago" style="border-width: 0px; top: 50px; left: ' + ($('#tte-calendar').position().left - 200) + 'px; position: absolute; z-index: 3000;" width="400" height="400" frameborder="0" scrolling="no"></iframe>');
      }
    });
    $('div.header div.room-buttons').before($button);
    
    // get settings from extension
    tte.eventManager.queue({api: 'settings', code: 'get'}, function(response) {
      // check if want notifications
      tte.ui.settings = $.extend(tte.ui.settings, response.settings);
      if(response.settings.notifications == -1 && window.webkitNotifications.checkPermission() == 1) {
        util.showOverlay(util.buildTree([
            "div.modal", {}, ["div.close-x",
            {
                event: {
                    click: util.hideOverlay
                }
            }], ["h1", "Add Chat Notifications"], ["br"], ["div.field",
            {}, "Would you like chat notifications to appear when someone says your name or private messages you?", ["br"]], ["div.ok-button.centered-button",
            {
                event: {
                    click: function() {
                      window.webkitNotifications.requestPermission();
                      tte.eventManager.queue({api: 'settings', code: 'set', settings: {notifications: 1}});
                      tte.ui.settings = 1;
                      util.hideOverlay();
                    }
                }
            }], ["p.cancel.no-thanks",
            {
                event: {
                    click: function() {
                      util.hideOverlay();
                      tte.eventManager.queue({api: 'settings', code: 'set', settings: {notifications: 0}});
                      tte.ui.settings = 0;
                    }
                },
                style: {
                    "padding-top": "10px"
                }
            }, "No"]]
        ));
      }
      if(!tte.ui.settings.animations)
        tte.ui.setAnimations(false);
      
      // update UI if necessary
      tte.ui.setDisplay(tte.ui.settings.displayType, false);
      
      // setup new version notifier
      if(tte.ui.version !== tte.ui.settings.currentVersion) {
        tte.eventManager.queue({api: 'set_version', version: tte.ui.version});
        
        util.buildTree([
          Modal,
          { title: 'TTEnhanced Updated! v' + tte.ui.version },
          ["div.fields", {} ]
        ], tte);
        tte.modal.$node.find('div.fields').css('padding', '0px 10px').html('<p style="margin-bottom: 15px;">See what\'s new in this version:</p>' + tte.ui.newUpdatesMsg);
        tte.modal.show();
      }
    });
  }
  
  $(document).ready(function() {
    var wait = 0,
    roomCheck = setInterval(function() {
      wait++;
      if($($('#turntable').find('div.roomView > div')[1]).height() > 0) {
        tte.ui.init();
        clearInterval(roomCheck);
      }
      else if(wait > 10)
        clearInterval(roomCheck);
    }, 1000);
  });
})();
$(window).blur(function(){$('html').addClass('blur').removeClass('active');}).focus(function(){$('html').removeClass('blur').addClass('active');});
