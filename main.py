# In[]:
import time
import AppKit
import objc
import Quartz

# Set the process name for Google Chrome
process_name = 'Google Chrome'

# In[]:

open_windows = Quartz.CGWindowListCopyWindowInfo(Quartz.kCGWindowListOptionOnScreenOnly, Quartz.kCGNullWindowID)
chrome_window = [app for app in open_windows if app['kCGWindowOwnerName'] == process_name][0]
chrome_window

# In[]:

chrome_app = AppKit.NSRunningApplication.runningApplicationWithProcessIdentifier_(chrome_window['kCGWindowOwnerPID'])
chrome_app.acc


# In[]:


chrome_element = None

# Find the Chrome window element in the accessibility hierarchy
for element in Quartz.CGWindowListCopyWindowInfo(Quartz.kCGWindowListOptionOnScreenOnly, Quartz.kCGNullWindowID):
    if (
        element.get("kCGWindowOwnerName").lower() == "google chrome"
        and element.get("kCGWindowIsOnscreen") == 1
    ):
        chrome_element = Quartz.AXUIElementCreateWithWindowID(
            element.get("kCGWindowNumber")
        )
        break