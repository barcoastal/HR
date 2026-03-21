#!/usr/bin/env python3
"""Migrate all lucide-react imports to use the Icon component."""

import re
import os
import sys

# Complete icon mapping from Lucide to Material Symbols
ICON_MAP = {
    "Search": "search",
    "Settings": "settings",
    "Plus": "add",
    "Check": "check",
    "Upload": "upload",
    "Download": "download",
    "Send": "send",
    "Save": "save",
    "Copy": "content_copy",
    "Info": "info",
    "Image": "image",
    "Globe": "language",
    "Play": "play_arrow",
    "Square": "stop",
    "Eye": "visibility",
    "EyeOff": "visibility_off",
    "Lock": "lock",
    "Pin": "push_pin",
    "Star": "star",
    "Code": "code",
    "ChevronDown": "expand_more",
    "ChevronUp": "expand_less",
    "ChevronLeft": "chevron_left",
    "ChevronRight": "chevron_right",
    "ArrowRight": "arrow_forward",
    "ArrowUpRight": "open_in_new",
    "LogOut": "logout",
    "LogIn": "login",
    "Menu": "menu",
    "Users": "group",
    "Users2": "groups",
    "UsersRound": "groups",
    "User": "person",
    "UserPlus": "person_add",
    "UserMinus": "person_remove",
    "UserCheck": "how_to_reg",
    "UserCircle": "account_circle",
    "X": "close",
    "XIcon": "close",
    "Pencil": "edit",
    "Trash2": "delete",
    "Loader2": "progress_activity",
    "AlertCircle": "error",
    "AlertTriangle": "warning",
    "CheckCircle2": "check_circle",
    "XCircle": "cancel",
    "Ban": "block",
    "RotateCcw": "undo",
    "RefreshCw": "refresh",
    "Filter": "filter_list",
    "FileText": "description",
    "FileSpreadsheet": "table_chart",
    "FileCheck": "task",
    "FileSignature": "draw",
    "Inbox": "inbox",
    "Paperclip": "attach_file",
    "Link2": "link",
    "Unlink": "link_off",
    "ClipboardCheck": "assignment_turned_in",
    "ClipboardList": "assignment",
    "Building": "apartment",
    "Building2": "business",
    "Briefcase": "work",
    "Layers": "layers",
    "Target": "target",
    "Archive": "archive",
    "Shield": "shield",
    "ShieldCheck": "verified_user",
    "Bell": "notifications",
    "Mail": "mail",
    "Phone": "phone",
    "MessageCircle": "chat_bubble",
    "Reply": "reply",
    "Megaphone": "campaign",
    "Video": "videocam",
    "Linkedin": "link",
    "ExternalLink": "open_in_new",
    "Calendar": "calendar_today",
    "CalendarDays": "calendar_month",
    "Clock": "schedule",
    "Sparkles": "auto_awesome",
    "Zap": "bolt",
    "Activity": "monitoring",
    "BarChart3": "bar_chart",
    "Camera": "photo_camera",
    "MapPin": "location_on",
    "Palmtree": "beach_access",
    "Cake": "cake",
    "PartyPopper": "celebration",
    "Heart": "favorite",
    "Smile": "mood",
    "Newspaper": "newspaper",
    "Cable": "cable",
    "PenTool": "edit_note",
    "PenLine": "edit_note",
    "MousePointer2": "mouse",
    "Circle": "circle",
    "LucideIcon": None,  # type only, handled separately
    "type LucideIcon": None,  # type only
}

SIZE_MAP = {
    "h-3 w-3": 12,
    "w-3 h-3": 12,
    "h-3.5 w-3.5": 14,
    "w-3.5 h-3.5": 14,
    "h-4 w-4": 16,
    "w-4 h-4": 16,
    "h-5 w-5": 20,
    "w-5 h-5": 20,
    "h-6 w-6": 24,
    "w-6 h-6": 24,
    "h-[18px] w-[18px]": 18,
    "w-[18px] h-[18px]": 18,
    "h-8 w-8": 32,
    "w-8 h-8": 32,
    "h-10 w-10": 40,
    "w-10 h-10": 40,
    "h-12 w-12": 48,
    "w-12 h-12": 48,
    "h-3 w-3.5": 14,
    "h-3.5 w-3": 14,
    "h-7 w-7": 28,
}

def extract_lucide_imports(content):
    """Extract all lucide icon names from import statements."""
    # Match multi-line imports from lucide-react
    pattern = r'import\s+\{([^}]+)\}\s+from\s+["\']lucide-react["\']'
    matches = re.findall(pattern, content, re.DOTALL)
    icons = []
    for match in matches:
        # Split by comma, strip whitespace and newlines
        items = [i.strip() for i in match.split(',')]
        for item in items:
            item = item.strip()
            if item:
                # Handle "type LucideIcon" style
                if item.startswith('type '):
                    icons.append(item)
                else:
                    icons.append(item)
    return icons

def remove_lucide_import(content):
    """Remove all lucide-react import lines."""
    # Handle multi-line imports
    pattern = r'import\s+\{[^}]+\}\s+from\s+["\']lucide-react["\'];?\n?'
    return re.sub(pattern, '', content, flags=re.DOTALL)

def add_icon_import(content):
    """Add the Icon import if not already present."""
    if 'from "@/components/ui/icon"' in content or "from '@/components/ui/icon'" in content:
        return content

    # Find first import line and add after it, or add at top
    # Find location to insert - after the last React-related import or at start
    lines = content.split('\n')
    insert_idx = 0
    for i, line in enumerate(lines):
        if line.startswith('import ') or line.startswith('// ') or line == '':
            if line.startswith('import '):
                insert_idx = i + 1

    # Insert the Icon import after the first block of imports
    lines.insert(insert_idx, 'import { Icon } from "@/components/ui/icon";')
    return '\n'.join(lines)

def get_size_from_classname(classname_str):
    """Extract size from className string based on h-N w-N pattern."""
    for pattern, size in SIZE_MAP.items():
        parts = pattern.split(' ')
        # Check if all parts are in classname
        all_present = all(p in classname_str for p in parts)
        if all_present:
            return size
    return None

def remove_size_classes(classname_str):
    """Remove h-N w-N size classes from className string."""
    # Remove size-related classes
    size_patterns = [
        r'\bh-\d+(?:\.\d+)?\b',
        r'\bw-\d+(?:\.\d+)?\b',
        r'\bh-\[\d+px\]\b',
        r'\bw-\[\d+px\]\b',
    ]
    result = classname_str
    for pattern in size_patterns:
        result = re.sub(pattern, '', result)
    # Clean up extra spaces
    result = re.sub(r'\s+', ' ', result).strip()
    return result

def replace_icon_jsx(content, icon_name):
    """Replace JSX usage of a Lucide icon with the Icon component."""
    material_name = ICON_MAP.get(icon_name)
    if material_name is None:
        return content

    # Pattern: <IconName className="..." /> or <IconName className="...">
    # Also handle: <IconName /> (no props)
    # And: <IconName\n  className="..."\n/>

    # Simple self-closing with className
    # Match <IconName ...className="..."... />
    def replace_icon_tag(m):
        full_match = m.group(0)
        attrs_str = m.group(1)

        # Extract className value
        cn_match = re.search(r'className=\{?["\']([^"\']*)["\']?\}?', attrs_str)
        cn_expr_match = re.search(r'className=\{([^}]+)\}', attrs_str)

        size = 24
        remaining_classes = ""

        if cn_match:
            classes = cn_match.group(1)
            size = get_size_from_classname(classes) or 24
            remaining_classes = remove_size_classes(classes)

        # Check for animate-spin (Loader2)
        has_animate_spin = 'animate-spin' in attrs_str

        # Build the new Icon tag
        props = [f'name="{material_name}"']
        if size != 24:
            props.append(f'size={{{size}}}')

        # Build className
        all_classes = []
        if has_animate_spin:
            all_classes.append('animate-material-spin')
        if remaining_classes:
            all_classes.append(remaining_classes)

        # Check for other attributes we want to keep (not className, not size-related)
        # Keep: color classes, flex classes, positioning, etc.
        # Remove: className itself (we'll rebuild it)

        if cn_expr_match and not cn_match:
            # Complex expression className - keep as is but remove size classes
            expr = cn_expr_match.group(1)
            if all_classes:
                props.append(f'className={{cn("{" ".join(all_classes)}", {expr})}}')
            else:
                props.append(f'className={{{expr}}}')
        elif all_classes:
            props.append(f'className="{" ".join(all_classes)}"')

        # Check for other non-className, non-size attrs we should keep
        other_attrs = re.sub(r'className=(?:\{[^}]+\}|"[^"]*"|\'[^\']*\')', '', attrs_str)
        other_attrs = re.sub(r'\s+', ' ', other_attrs).strip()
        # Don't include strokeWidth, etc. as Icon doesn't use them
        # But keep data- and aria- attributes
        aria_data = re.findall(r'(?:aria|data)-[a-zA-Z-]+=(?:\{[^}]+\}|"[^"]*"|\'[^\']*\')', other_attrs)
        for ad in aria_data:
            props.append(ad)

        return f'<Icon {" ".join(props)} />'

    # Match self-closing tags with optional attributes
    pattern = rf'<{re.escape(icon_name)}(\s[^>]*)?\s*/>'
    content = re.sub(pattern, replace_icon_tag, content, flags=re.DOTALL)

    return content

def migrate_file(filepath):
    """Migrate a single file from lucide-react to Icon component."""
    with open(filepath, 'r') as f:
        original = f.read()

    # Check if file has lucide-react imports
    if 'lucide-react' not in original:
        print(f"  SKIP (no lucide-react): {filepath}")
        return False

    content = original

    # Extract icon names
    icons = extract_lucide_imports(content)

    # Icons that are actual components (not types)
    component_icons = [i for i in icons if not i.startswith('type ') and i != 'LucideIcon' and i in ICON_MAP]
    type_only = [i for i in icons if i.startswith('type ') or i == 'LucideIcon']

    # Remove lucide import
    content = remove_lucide_import(content)

    # Replace each icon usage
    for icon in component_icons:
        content = replace_icon_jsx(content, icon)

    # Add Icon import (only if we actually use it)
    if component_icons:
        content = add_icon_import(content)

    # Write back
    with open(filepath, 'w') as f:
        f.write(content)

    print(f"  DONE: {filepath}")
    print(f"    Icons: {component_icons}")
    return True

# All files to migrate
FILES = [
    "src/app/(auth)/login/page.tsx",
    "src/app/(dashboard)/analytics/page.tsx",
    "src/app/(dashboard)/clubs/page.tsx",
    "src/app/(dashboard)/cv/page.tsx",
    "src/app/(dashboard)/my-profile/page.tsx",
    "src/app/(dashboard)/offboarding/page.tsx",
    "src/app/(dashboard)/onboarding/page.tsx",
    "src/app/(dashboard)/org/departments/page.tsx",
    "src/app/(dashboard)/org/page.tsx",
    "src/app/(dashboard)/people/[id]/page.tsx",
    "src/app/(dashboard)/pre-onboarding/page.tsx",
    "src/app/(dashboard)/reviews/page.tsx",
    "src/app/(dashboard)/time-off/page.tsx",
    "src/app/(dashboard)/welcome/page.tsx",
    "src/app/(public)/sign/[token]/page.tsx",
    "src/components/people/people-list.tsx",
    "src/components/people/add-employee-form.tsx",
    "src/components/people/bulk-employee-import.tsx",
    "src/components/people/delete-employee-button.tsx",
    "src/components/people/edit-employee-dialog.tsx",
    "src/components/people/employee-documents-section.tsx",
    "src/components/people/hr-notes-section.tsx",
    "src/components/org/org-tree.tsx",
    "src/components/org/manager-assignment.tsx",
    "src/components/org/department-actions.tsx",
    "src/components/calendar/calendar-view.tsx",
    "src/components/cv/add-candidate-form.tsx",
    "src/components/cv/add-candidate-to-position.tsx",
    "src/components/cv/add-position-form.tsx",
    "src/components/cv/candidate-database.tsx",
    "src/components/cv/candidate-detail-dialog.tsx",
    "src/components/cv/candidate-pipeline.tsx",
    "src/components/cv/csv-import.tsx",
    "src/components/cv/cv-tabs.tsx",
    "src/components/cv/platform-sync-panel.tsx",
    "src/components/cv/schedule-interview-dialog.tsx",
    "src/components/cv/search-candidates.tsx",
    "src/components/feed/post-card.tsx",
    "src/components/feed/post-composer.tsx",
    "src/components/feed/comment-section.tsx",
    "src/components/onboarding/onboarding-timeline.tsx",
    "src/components/onboarding/onboarding-preview.tsx",
    "src/components/onboarding/onboarding-task-manager.tsx",
    "src/components/onboarding/my-onboarding-tasks.tsx",
    "src/components/reviews/add-review-dialog.tsx",
    "src/components/reviews/create-cycle-dialog.tsx",
    "src/components/reviews/cycle-actions.tsx",
    "src/components/reviews/generate-reviews-dialog.tsx",
    "src/components/reviews/submit-review-dialog.tsx",
    "src/components/reviews/view-review-dialog.tsx",
    "src/components/settings/checklist-manager.tsx",
    "src/components/settings/cleanup-demo-button.tsx",
    "src/components/settings/company-info.tsx",
    "src/components/settings/department-manager.tsx",
    "src/components/settings/email-template-manager.tsx",
    "src/components/settings/job-title-manager.tsx",
    "src/components/settings/native-integrations.tsx",
    "src/components/settings/offboarding-setup.tsx",
    "src/components/settings/onboarding-setup.tsx",
    "src/components/settings/permissions-manager.tsx",
    "src/components/settings/platform-connect-dialog.tsx",
    "src/components/settings/platform-integration-manager.tsx",
    "src/components/settings/pto-policy-manager.tsx",
    "src/components/settings/pulse-survey-manager.tsx",
    "src/components/settings/recruiter-manager.tsx",
    "src/components/settings/user-management.tsx",
    "src/components/time-off/burnout-alerts.tsx",
    "src/components/time-off/request-list.tsx",
    "src/components/time-off/request-time-off-dialog.tsx",
    "src/components/time-off/team-calendar.tsx",
    "src/components/time-off/whos-out-widget.tsx",
    "src/components/documents/document-signing-manager.tsx",
    "src/components/signing/signing-page.tsx",
    "src/components/my-profile/edit-about-dialog.tsx",
    "src/components/my-profile/edit-emergency-contact-dialog.tsx",
    "src/components/my-profile/edit-personal-info-dialog.tsx",
    "src/components/my-profile/profile-photo-upload.tsx",
    "src/components/offboarding/start-offboarding-dialog.tsx",
    "src/components/analytics/ai-analytics-bar.tsx",
    "src/components/clubs/club-card.tsx",
    "src/components/clubs/create-club-dialog.tsx",
    "src/components/pulse/pulse-popup.tsx",
    "src/components/voice/feedback-form.tsx",
    "src/components/voice/feedback-list.tsx",
]

base_dir = "/Users/baralezrah/hr-platform"

print("Starting migration...")
migrated = 0
for f in FILES:
    filepath = os.path.join(base_dir, f)
    if os.path.exists(filepath):
        if migrate_file(filepath):
            migrated += 1
    else:
        print(f"  NOT FOUND: {filepath}")

print(f"\nMigrated {migrated} files")
