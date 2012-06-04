class TurntableProxy
	constructor: (@turntable) ->
		@updateRoom()
		@updateRoomManager()
		
	isReady: ->
		@room? and @roomManager?

	updateRoom: =>
		for own key, value of @turntable
			@room = value if value? and value.hasOwnProperty "currentDj"
		setTimeout @updateRoom, 100 unless @room?
						
	updateRoomManager: =>
		for own key, value of window
			@roomManager = value if value? and value.hasOwnProperty "become_dj"
		setTimeout @updateRoomManager, 100 unless @roomManager

	getUserIdByName: (name) ->
		for userid of @room.users
			user = @room.users[userid]
			return user.userid if user.name.toLowerCase() is $.trim name.toLowerCase()
		return false

	appendActionMessage: (text, username) ->
		username = "" unless username?
		@room.appendChatMessage '', username, text, "action"

	toggleMute: ->
		@roomManager.set_volume if @roomManager.volume_bars then 0 else @roomManager.last_volume_bars
		@roomManager.callback "set_volume", @roomManager.volume_bars
		@appendActionMessage (if @roomManager.volume_bars then "Unmuted" else "Muted"), "Sound: "

	sendSocketMessage: (data, handler) ->
		data.msgid = @turntable.messageId
		data.clientId = @turntable.clientId
		@turntable.messageId += 1
		
		if @turntable.user.id and not data.userid
			data.userid = @turntable.user.id
			data.userauth = @turntable.user.auth
		
		jsonData = JSON.stringify data
		deferred = $.Deferred()
		
		@turntable.whenSocketConnected ->
			@turntable.socket.send jsonData
			@turntable.socketKeepAlive true
			@turntable.pendingCalls.push 
				msgid: data.msgid
				handler: handler
				deffered: deferred
				time: window.util.now()
				
		return deferred.promise()

	boot: (userid, reason) ->
		message = 
			api: "room.boot_user"
			roomid: @room.roomId
			target_userid: userid
		message.reason = reason if reason isnt ""

		@sendSocketMessage message
		console.log "Booting: #{@room.users[userid].name} #{userid} reason: #{reason}"

	removeDj: (userid) ->
		message =
			api: "room.rem_dj"
			roomid: @room.roomId
			djid: userid

		if @room.isDj userid
			@sendSocketMessage message
			console.log "Removing DJ: #{@room.users[userid].name} #{userid}"
		else
			@appendActionMessage "#{@room.users[userid].name} is not a DJ.", "RemoveDJ: "

	awesomeSong: ->
		@roomManager.callback "upvote"

	lameSong: ->
		@roomManager.callback "downvote"

class TurntableCli
	textInput = null
	maxHistory = 100
	currentHistoryIndex = 0

	suggestedCommands = []
	suggestedCommand = false
	
	commands = [
		"/awesome"
		"/clear"
		"/lame"
		"/mute"
		"/pm"
		"/snag"
	]
	
	modCommands = [
		"/boot"
		"/removedj"
	]

	constructor: (turntable) ->
		@turntableProxy = new TurntableProxy turntable
		@textHistory = []
		@init()

	init: =>
		# Ensure TurntableProxy is ready
		if not @turntableProxy.isReady()
			setTimeout @init, 200
			return
		else
			console.log "TurntableCli Initialized"

		textForm = $ @turntableProxy.room.nodes.chatForm
		textInput = $ @turntableProxy.room.nodes.chatText

		commands = commands.concat modCommands if @turntableProxy.room.isMod()

		# Create Text Input Proxy
		textForm.unbind 'submit'
		textForm.submit @handleInputSubmit
		
		# Add Text Input Key Listener
		textInput.unbind 'keydown'
		textInput.keyup @handleInputKeyUp
		textInput.keydown @handleInputKeyDown

		# Add custom placeholder
		$(textInput).attr "placeholder", "Enter a message or command"


	handleInputSubmit: (event) =>
		event.preventDefault()
		text = $.trim textInput.val()
		return if text is ""

		if not @parseInputText text
			@addTextEntry text
			@turntableProxy.room.speak event 

	handleInputKeyDown: (event) =>
		target = event.target
		key = event.charCode || event.keyCode
		if suggestedCommand && textInput.val().match /^\//
			switch key
				when 13, 9
					@chooseSuggestedCommand target, suggestedCommand
					return false
				when 38
					previous = $(".suggestedName.selected").prev()
					if previous.length
						suggestedCommand = $(".suggestedName.selected").removeClass("selected").prev().addClass("selected").text()					
					return false
				when 40
					next = $(".suggestedName.selected").next()
					if next.length
						suggestedCommand = $(".suggestedName.selected").removeClass("selected").next().addClass("selected").text()
					return false
				when 27, 39
					if (key is 39 and target.selectionEnd is target.value.length) || key is 27
						@turntableProxy.room.cancelNameSuggest()
						return false
		else
			switch key
				when 38
					if not suggestedCommand and not @turntableProxy.room.suggestedName
						@textHistoryNext()
				when 40
					if not suggestedCommand and not @turntableProxy.room.suggestedName
						@textHistoryPrev()
				when 27
					if not suggestedCommand and not @turntableProxy.room.suggestedName
						@clear()

		return @turntableProxy.room.chatKeyDownListener event

	handleInputKeyUp: (event) =>
		text = $.trim textInput.val()
		key = event.charCode || event.keyCode

		currentHistoryIndex = 0 if text is ""

		return if key is 38 or key is 40 or key is 27 or (key is 39 and event.target.selectionEnd is event.target.value.length)

		# Command Suggest
		suggestedCommand = false
		if /^\//.test text
			$("#nameSuggest").remove()

			suggestedCommands = []

			$.each commands,
				->
					suggestedCommands.push @ if (@.toLowerCase().slice(0, -1).indexOf text) is 0

			if suggestedCommands.length
				window.util.alphabetize suggestedCommands
				suggest = window.util.buildTree window.Room.layouts.nameSuggest(suggestedCommands)
				suggestedCommand = suggestedCommands[0]
				$("body").append suggest

				offset = textInput.offset()
				$(suggest).css
					left: "#{offset.left + 1}px"
					top: "#{offset.top + 1 - $(suggest).outerHeight()}px"
				$(".suggestedName").click (option) =>
					@chooseSuggestedCommand false, $(option.target).text()
				$(".suggestedName").mouseover (option) ->
					unless $(this).hasClass "selected"
						suggestedCommand = $(@).text
						$(".suggestedName.selected").removeClass "selected"
						$(@).addClass "selected"
			else
				return @turntableProxy.room.chatTextListener event

		return true

	chooseSuggestedCommand: (target, value) =>
		return unless value?
		target = textInput unless target?
		$(textInput).val("#{value} ")
		@turntableProxy.room.cancelNameSuggest()

	addTextEntry: (entry) ->
		@textHistory.unshift entry
		# prune if needed
		@textHistory.shift() while @textHistory.length > maxHistory

	textHistoryNext: ->
		if currentHistoryIndex is 0 and @textHistory.length <= 0
			$(textInput).val ""
		else if currentHistoryIndex >= @textHistory.length
			$(textInput).val @textHistory[@textHistory.length - 1]
		else
			currentHistoryIndex++;
			$(textInput).val @textHistory[currentHistoryIndex - 1]

	textHistoryPrev: ->
		if currentHistoryIndex is 0
			$(textInput).val ""
		else
			currentHistoryIndex--;
			$(textInput).val @textHistory[currentHistoryIndex - 1]

	clear: ->
		currentHistoryIndex = 0 if ($.trim $(textInput).val()) is ""
		@addTextEntry $.trim $(textInput).val()
		$(textInput).val ''

	parseInputText: (text) ->
		# return false to pass to Turntable

		# mod commands
		if @turntableProxy.room.isMod()
			switch true
				when /^\/boot[ ]*/i.test text # Boot Users
					# Get args
					users = text.split(" /")[0].split ' @'
					users.shift()
					reason = if text.split(" /")[1]? then text.split(" /")[1] else ""

					# Get userIds
					if users.length <= 0
						@turntableProxy.appendActionMessage "No users specified to boot.", "Boot: "
					else
						for username in users
							if @turntableProxy.getUserIdByName ($.trim username)
								@turntableProxy.boot (@turntableProxy.getUserIdByName ($.trim username)), reason
							else
								@turntableProxy.appendActionMessage "User @#{username} not found.", "Boot: "

					@clear()
					return true
				when /^\/removedj[ ]*/i.test text # Remove DJ
					isPositions = false
					# get args
					args = text.split ' '
					args.shift()

					prunedArgs = []
					# prune whitespace
					for arg in args
						prunedArgs.push ($.trim arg) if arg isnt ""

					if prunedArgs.length > 0
						# determine names or positions
						isPositions = if prunedArgs[0][0] is "@" then false else true

						if isPositions
							# parse positions
							#@turntableProxy.room.maxDjs
							positions = prunedArgs
							for position in positions
								if isNaN(position) or Number(position) > @turntableProxy.room.maxDjs or Number(position) < 1
									@turntableProxy.appendActionMessage "Position #{position} is invalid.", "RemoveDJ: "
									continue
								else
									# Get User ID by positions
									@turntableProxy.removeDj @turntableProxy.room.djIds[position - 1]
						else
							# parse names
							names = text.split ' @'
							names.shift()
							for name in names
								@turntableProxy.removeDj @turntableProxy.getUserIdByName name if @turntableProxy.getUserIdByName name
					else
						@turntableProxy.appendActionMessage "No DJ's specified to remove.", "RemoveDJ: "

					@clear()
					return true
		
		# non-mod commands
		switch true
			when /^\/awesome[ ]*$/i.test text # Awesome Current Song
				@turntableProxy.awesomeSong()
				@clear()
				return true
			when /^\/clear[ ]*$/i.test text # Clear the chat window
				$(window.turntableCli.turntableProxy.room.nodes.chatLog).find('div.message').remove()
				@clear()
				return true
			when /^\/lame[ ]*$/i.test text # Lame Current Song
				@turntableProxy.lameSong()
				@clear()
				return true
			when /^\/mute[ ]*$/i.test text # Toggle Mute
				@turntableProxy.toggleMute()
				@clear()
				return true
			when /^\/pm[ ]*/i.test text # Send Private Message
				name = text.split(" /")[0].split(' @')[1]

				if @turntableProxy.getUserIdByName name
					@turntableProxy.room.handlePM
						senderid: @turntableProxy.getUserIdByName name
				else
					@turntableProxy.appendActionMessage "User @#{name} doesn't appear to be in this room.", "PM: "

				@clear()
				return true
			when /^\/snag[ ]*$/i.test text # Snag a song to your queue
				@turntableProxy.room.addSong "queue"
				@clear()
				return true

		return false


$(document).ready ->
	window.turntableCli = new TurntableCli window.turntable