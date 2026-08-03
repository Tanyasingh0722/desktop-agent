tell application "System Events"
	set frontApp to first application process whose frontmost is true
	set appName to name of frontApp
	set winBounds to {0, 0, 0, 0}
	try
		set wBounds to position of front window of frontApp & size of front window of frontApp
		set winBounds to wBounds
	end try
end tell
set tabName to ""
if appName is "Google Chrome" then
	try
		tell application "Google Chrome"
			if (count of windows) > 0 then
				set tabName to title of active tab of front window
			end if
		end tell
	end try
end if
return appName & "||" & tabName & "||" & item 1 of winBounds & "," & item 2 of winBounds & "," & item 3 of winBounds & "," & item 4 of winBounds
