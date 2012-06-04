# TurntableCli

A simple chrome extension that enhances the convenience and usability of the chat text input box in the Turntable.FM UI. Works with any Turntable.FM extension or add-on that does not modify event handlers keyup, keydown and submit for the chat form and its components.

## Features
+	Interact with the UI functions directly from the chat input box.
+	Live command auto-suggest
+	Moderator actions are much more quick and efficient without having to deal with the popup windows.
+	100 line input history. Simply press your up and down arrows to access previous entries. 

## Installation

Simply download and install the .crx file to your Google Chrome installation. You'll be aware that the extension worked properly by seeing 'Enter a message or command' as the text input placeholder.

# Documentation

## General Note

When dealing with commands that require usernames as arguments, please be aware that double '@'s are required to specify users whose names start with '@.' This is to prevent from executing actions on the wrong listener in the event two people have the same name -- one with the '@' and one without.

## Input History

TurntableCli will track the last 100 entries you made into the chat box. You can navigate these entires similar to a nix-based shell by pressing the up and down arrows while the chat input field has focus.

Pressing escape will clear the input provided the suggest popup is not active.

## Moderator Commands

### /boot \<users...\> /\<reason\>

Will promptly boot specified users without prompting for confirmation or reason.

#### Examples

	/boot @user1 @@user2

Boots user1 and @user2 without a specified reason

	/boot @user1 @@user2 /Stop spamming.

Boots user1 and @user2 with a specified reason of 'Stop spamming.'

### /removedj \<positions\> AND /removedj \<names\>

Will promptly remove DJs specified by name or specified by DJ position. Note that you can only use names or positions exclusively during a single use of the command.

#### Examples

	/removedj 1

Removes the very first DJ

	/removedj @user1 @@user2

Removes user1 and @user2 from deck assuming they are DJ's.

## User Commands

### /awesome

Awesomes the current song

### /clear

Clears the chat log

### /lame

Lames the current song

### /mute

Toggles sound muting.

### /pm \<users\>

Starts a PM conversation with the specified users

#### Example

	/pm @user1

Starts a private message conversation with user1.

### /snag

Snags the current song and places it in your queue.