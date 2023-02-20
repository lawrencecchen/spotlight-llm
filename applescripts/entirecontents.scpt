tell application "System Events"
	tell application process "Safari"
		tell scroll area 1 of group 1 of group 1 of tab group 1 of splitter group 1 of window "Google"
			tell UI element 1
				entire contents
			end tell
		end tell
	end tell
end tell