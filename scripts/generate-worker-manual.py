from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    FrameBreak,
    HRFlowable,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "manuals" / "mileage-tracker-worker-user-manual.pdf"


BLUE = colors.HexColor("#2f8fc8")
DARK = colors.HexColor("#0f172a")
TEXT = colors.HexColor("#334155")
MUTED = colors.HexColor("#64748b")
LIGHT_BLUE = colors.HexColor("#eaf6fd")
LIGHT_GRAY = colors.HexColor("#f8fafc")
GREEN = colors.HexColor("#dcfce7")
AMBER = colors.HexColor("#fef3c7")


styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        name="CoverTitle",
        fontName="Helvetica-Bold",
        fontSize=28,
        leading=34,
        alignment=TA_CENTER,
        textColor=DARK,
        spaceAfter=14,
    )
)
styles.add(
    ParagraphStyle(
        name="CoverSubtitle",
        fontName="Helvetica",
        fontSize=12,
        leading=18,
        alignment=TA_CENTER,
        textColor=MUTED,
        spaceAfter=24,
    )
)
styles.add(
    ParagraphStyle(
        name="SectionTitle",
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=DARK,
        spaceBefore=8,
        spaceAfter=8,
    )
)
styles.add(
    ParagraphStyle(
        name="Subhead",
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=DARK,
        spaceBefore=10,
        spaceAfter=4,
    )
)
styles.add(
    ParagraphStyle(
        name="Body",
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=TEXT,
        spaceAfter=7,
    )
)
styles.add(
    ParagraphStyle(
        name="Small",
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=MUTED,
    )
)
styles.add(
    ParagraphStyle(
        name="Callout",
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=13,
        textColor=DARK,
        leftIndent=8,
        rightIndent=8,
        spaceBefore=4,
        spaceAfter=4,
    )
)


def p(text, style="Body"):
    return Paragraph(text, styles[style])


def bullets(items):
    return ListFlowable(
        [ListItem(p(item), leftIndent=8) for item in items],
        bulletType="bullet",
        start="circle",
        leftIndent=16,
        bulletFontName="Helvetica",
        bulletFontSize=7,
        spaceBefore=2,
        spaceAfter=8,
    )


def numbered(items):
    return ListFlowable(
        [ListItem(p(item), leftIndent=8) for item in items],
        bulletType="1",
        leftIndent=18,
        bulletFontName="Helvetica-Bold",
        bulletFontSize=9,
        spaceBefore=2,
        spaceAfter=8,
    )


def callout(text, color=LIGHT_BLUE):
    table = Table([[p(text, "Callout")]], colWidths=[6.6 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), color),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return table


def feature_table(rows, widths=(1.7, 4.9)):
    table_data = [[p(a, "Subhead"), p(b, "Body")] for a, b in rows]
    table = Table(table_data, colWidths=[widths[0] * inch, widths[1] * inch], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#e2e8f0"))
    canvas.line(0.7 * inch, 0.55 * inch, 7.8 * inch, 0.55 * inch)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(0.7 * inch, 0.35 * inch, "Prosper Real Estate Mileage Tracker User Manual")
    canvas.drawRightString(7.8 * inch, 0.35 * inch, f"Page {doc.page}")
    canvas.restoreState()


def section(title, body=None):
    parts = [p(title, "SectionTitle")]
    if body:
        parts.append(p(body))
    return parts


def build_manual():
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=letter,
        rightMargin=0.7 * inch,
        leftMargin=0.7 * inch,
        topMargin=0.65 * inch,
        bottomMargin=0.75 * inch,
        title="Mileage Tracker User Manual",
        author="Prosper Real Estate",
    )

    story = []

    story.append(Spacer(1, 0.65 * inch))
    story.append(p("Prosper Real Estate", "CoverSubtitle"))
    story.append(p("Mileage Tracker Worker User Manual", "CoverTitle"))
    story.append(
        p(
            "Updated June 30, 2026. This manual explains the full worker flow: account setup, mileage entry, Jobber work, timesheets, company vehicle odometers, reports, paper sheets, messages, route tools, and support.",
            "CoverSubtitle",
        )
    )
    story.append(callout("Main rule: every mileage entry needs a vehicle and either a Jobber job/timesheet or a normal Prosper property. If Jobber is selected, a separate normal property is not required.", GREEN))
    story.append(Spacer(1, 0.25 * inch))
    story.append(feature_table([
        ("Who Uses This", "Workers and team members submitting mileage in the Prosper Mileage Tracker app."),
        ("Where To Open It", "Worker Dashboard - Help - Open User Manual, or the User Manual card on the Overview page."),
        ("Vehicle Privacy", "New workers automatically see company vehicles, their own personal vehicle, and vehicles assigned to them. Workers should not see another worker's personal vehicle."),
        ("Odometer Rule", "Company vehicles share one current odometer by exact vehicle or fleet unit. New company vehicles start at 0 until the first saved entry updates them."),
    ]))
    story.append(PageBreak())

    story += section("1. Account Setup And Sign In")
    story.append(numbered([
        "Open the Mileage Tracker app link provided by Prosper Real Estate.",
        "Choose Create Account or Sign Up if you do not have an account yet.",
        "Enter your email address and create a secure password.",
        "Confirm your email if the app asks you to verify it.",
        "Sign in from the Login page.",
        "Complete your worker profile or onboarding screen if the app asks for your name or role information.",
    ]))
    story.append(feature_table([
        ("Returning User", "Use Login with the same email and password."),
        ("Forgot Password", "Use Reset Password from the login page and follow the email instructions."),
        ("New Worker", "After your account is active, company vehicles should appear in the vehicle dropdown automatically. Your personal vehicle is only for you."),
    ]))
    story.append(callout("If you can sign in but the wrong dashboard opens, message admin so your worker profile can be checked.", AMBER))

    story += section("2. Best Daily Workflow")
    story.append(numbered([
        "Start with Jobber: use the correct Jobber job, visit, or timesheet when the driving is for Jobber work.",
        "Open Mileage Tracker before or after the trip and choose the exact vehicle.",
        "For company vehicles, confirm the start odometer shown by the app. If the real vehicle reading is different, enter the real reading and explain the reason.",
        "Choose the Jobber record or the normal Prosper property.",
        "Enter the end odometer, purpose, and note.",
        "Save the entry the same day whenever possible so the next driver sees the correct shared odometer.",
    ]))
    story.append(callout("Same-day entry keeps company vehicle odometers continuous between drivers.", GREEN))

    story += section("3. Worker Dashboard Features")
    story.append(feature_table([
        ("Overview", "Shows the selected month, your role, latest vehicle, total entries, total miles, paper uploads, quick actions, recent mileage, the manual, and Central Wisconsin Map Search."),
        ("New Mileage Entry", "Use this for daily mileage. Add date, vehicle, Jobber job or property, odometer readings, purpose, and note."),
        ("Timesheets", "Review synced Jobber time records and add mileage to timesheets that involved driving."),
        ("Mileage History", "Review saved entries, edit corrections when allowed, and download a CSV for the selected month."),
        ("Upload Paper Sheet", "Upload a JPG, PNG, WEBP, or PDF paper mileage sheet. AI scanning can turn it into editable draft rows."),
        ("Messages", "Chat with admin about missing vehicles, property questions, paper sheets, and corrections."),
        ("Help", "Open this manual, use help cards, and search routes with Google Maps."),
    ]))

    story.append(PageBreak())
    story += section("4. New Mileage Entry: Step By Step")
    story.append(numbered([
        "Open New Mileage Entry.",
        "Choose the trip date.",
        "Choose the vehicle. If it is a company fleet vehicle, select the exact unit such as Van #1, Van #2, Tall Boy #6, or Tall Boy #7.",
        "If the vehicle is missing, choose Other company vehicle and type the exact vehicle name.",
        "If the mileage is for Jobber work, select the Jobber Visit or Jobber Job from the Jobber picker.",
        "If the mileage is not tied to Jobber, search and select the normal Prosper property.",
        "Enter the start odometer and end odometer.",
        "Add a purpose or note that explains why the trip happened.",
        "Review Total Miles. It is calculated as End Odo minus Start Odo.",
        "Click Save Entry.",
    ]))
    story.append(callout("Jobber entry: select Jobber and save without selecting a separate normal property. Non-Jobber entry: select the normal property before saving.", GREEN))
    story.append(feature_table([
        ("Required Fields", "Date, vehicle, Jobber job/timesheet or property, start odometer, and end odometer."),
        ("Purpose / Note", "Use this for details like inspection, showing, office errand, supply run, keys, signs, or why an odometer was different."),
        ("End Odometer", "The end odometer must be the same as or higher than the start odometer."),
    ]))

    story += section("5. Vehicle Dropdown, Fleet Units, And Privacy")
    story.append(p("The vehicle dropdown is designed to protect privacy and keep company vehicle odometers accurate. Company vehicles are shared. Personal vehicles are worker-specific. Fleet units are separated because each physical vehicle has its own odometer."))
    story.append(feature_table([
        ("Personal", "Use Personal only for your own vehicle. Workers should not see other workers' personal vehicles."),
        ("Company Vehicles", "Company vehicles are available to workers automatically when active in the app."),
        ("Assigned Vehicles", "Admin can assign a specific vehicle to a worker when needed."),
        ("Ford Transit Units", "Prosper Van - Ford Transit is split into Van #1, Van #2, Van #3, Van #4, and Van #5."),
        ("Ram / Tall Boy Units", "Ram ProMaster, Roadmaster, or Tall Boy vehicles are split into Tall Boy #6 and Tall Boy #7 when applicable."),
        ("Other Company Vehicle", "Use this when the company vehicle is not listed. Type the exact vehicle name the same way each time."),
    ]))
    story.append(callout("Important: different spelling creates a different shared odometer record. Example: 'Tall Boy #6' and 'Tallboy 6' can be treated as different vehicles.", AMBER))

    story += section("6. Shared Company Vehicle Odometer")
    story.append(p("Company vehicles use one shared current odometer across all workers. The app stores this by exact vehicle or fleet unit, not by driver. This is what makes the odometer pass from one driver to the next."))
    story.append(numbered([
        "Select the exact company vehicle or fleet unit.",
        "If it is a new company vehicle in the app, the shared start odometer begins at 0.",
        "After the first saved trip, the saved end odometer becomes the shared current odometer.",
        "The next driver sees that shared current odometer as the expected start odometer.",
        "When that driver saves, the shared odometer updates again.",
    ]))
    story.append(callout("For company vehicles, the end odometer you save becomes the starting point shown to the next driver.", GREEN))

    story += section("7. Confirm Or Override Odometer")
    story.append(p("When a company vehicle's real odometer does not match the shared odometer in the app, use the override field. The app keeps the expected reading, the entered reading, the reason, and any unattributed miles for admin review."))
    story.append(feature_table([
        ("Confirm", "If the start odometer shown by the app matches the vehicle, continue normally."),
        ("Override", "If the vehicle reading is different, enter the real start odometer and add a clear reason before saving."),
        ("Good Reasons", "Paper sheet not entered yet, vehicle moved for service, fuel trip not submitted, admin correction needed, or previous trip missing."),
        ("Admin Review", "Admin can review override reasons and unattributed miles in reports."),
    ]))

    story.append(PageBreak())
    story += section("8. Jobber Visits, Jobs, And Timesheets")
    story.append(p("Use Jobber whenever the mileage is connected to actual Jobber work. Jobber records make reports clearer because admin can see the job title, job number, client, property address, and Jobber link."))
    story.append(feature_table([
        ("Jobber Visit / Job", "Use the Jobber picker inside New Mileage Entry when the trip belongs to a Jobber visit or job."),
        ("Jobber Timesheet", "Use the Timesheets page when a synced Jobber time record needs mileage attached."),
        ("Jobber Link", "History and reports show a Jobber link when the app has enough Jobber data. Click it to open the matching Jobber job in a new tab."),
        ("No Separate Property", "When Jobber is selected, the normal property field is not required because the Jobber record supplies the client and address."),
    ]))
    story.append(numbered([
        "Open Timesheets.",
        "Choose the month.",
        "Find the synced Jobber time record.",
        "Review status: Needs Review means mileage still needs to be added; Completed means mileage is already linked.",
        "Click Add Mileage.",
        "Choose the exact vehicle or Other company vehicle.",
        "Confirm or override the shared odometer.",
        "Add a purpose or mileage note.",
        "Save Timesheet Mileage.",
    ]))
    story.append(callout("If a Jobber link opens Record Not Found, message admin. The job may have been removed in Jobber, the synced ID may be old, or Jobber permissions may block the record.", AMBER))

    story += section("9. Normal Properties And Property Codes")
    story.append(p("Use the normal property search when the trip is not tied to a Jobber job or Jobber timesheet. You can search by property code, street name, house number, city, or visible property label."))
    story.append(feature_table([
        ("Property Required", "A normal property is required only when there is no Jobber job, visit, or timesheet selected."),
        ("Property Code", "The code identifies the Prosper property in reports. Example: W10498 Bain is BA10498 because Bain provides BA and 10498 provides the number."),
        ("Short Addresses", "Some three-number addresses use X after the number in the property code. North, South, East, and West are ignored when building codes."),
        ("Office Mileage", "For Prosper Office work, select LIVEEC when the app note asks for it."),
        ("Cannot Find It", "Try address, code, house number, or city. If it still does not appear, message admin instead of guessing."),
    ]))

    story += section("10. Mileage Buckets, Purpose, And Notes")
    story.append(p("Mileage is organized into three report buckets. This helps admin review Jobber work, regular business mileage, and personal excluded mileage separately."))
    story.append(feature_table([
        ("Jobber Job", "Mileage connected to a Jobber job, visit, active job, or timesheet."),
        ("General Business", "Business mileage not tied to Jobber. Common options include Office / Admin, Supply Run, Bank Deposit, Maintenance / Materials, Showing / Inspection, Lockbox / Keys, Sign / Marketing, Meeting / Training, Fuel / Vehicle Service, and Other Business."),
        ("Personal Excluded", "Personal vehicle mileage that should not be counted as company mileage."),
        ("Always Add A Note", "The purpose or note field is always available. Use it to explain anything admin would need to understand later."),
    ]))

    story += section("11. Mileage History And CSV Downloads")
    story.append(numbered([
        "Open Mileage History.",
        "Choose the month you want to review.",
        "Review date, vehicle, Jobber job or property, purpose, odometers, miles, and status.",
        "Use Edit or Delete if those actions are available and you need to correct an entry.",
        "Use Download CSV for a spreadsheet copy of the selected month.",
    ]))
    story.append(feature_table([
        ("Jobber Display", "Jobber entries show the Jobber job title, client name, property address, and Jobber link when available."),
        ("Normal Property", "Non-Jobber entries show the normal property code and property information."),
        ("CSV Columns", "Exports include useful Jobber and mileage fields such as Jobber Job Title, Jobber Job Number, Jobber Client, Jobber Address, Jobber Link, Normal Property, Property Code, Bucket, Business Category, Purpose, Miles, and Status."),
    ]))

    story.append(PageBreak())
    story += section("12. Paper Sheets And AI Draft Rows")
    story.append(p("Use Upload Paper Sheet when mileage was written on a paper form or needs manual review. Uploads go to admin immediately. AI scanning can create editable draft rows from the uploaded sheet."))
    story.append(numbered([
        "Open Upload Paper Sheet.",
        "Choose a clear JPG, PNG, WEBP, or PDF file up to 10 MB.",
        "Select the mileage month.",
        "Add notes for admin, especially if a row is circled or hard to read.",
        "Click Upload Paper Sheet.",
        "In Upload History, click Open to view the file when needed.",
        "Use Scan With AI to create editable draft rows.",
        "Review every draft row: date, vehicle, property text, property code, start odometer, end odometer, miles, and purpose.",
        "Use Save Draft while correcting rows.",
        "Click Submit Entries only after every row is accurate.",
    ]))
    story.append(callout("AI draft rows are a helper, not a final answer. Always review and correct them before submitting.", AMBER))

    story += section("13. Messages, Help, And Map Search")
    story.append(feature_table([
        ("Messages", "Use Messages to chat with admin about missing mileage, property questions, vehicle list issues, Jobber sync questions, paper sheet review, or corrections."),
        ("Need Help Assistant", "Use the built-in help assistant for quick guidance and shortcuts to New Mileage Entry, Upload Paper Sheet, Mileage History, Messages, Overview, and the manual."),
        ("Manual", "Use Open User Manual to read this guide in the browser. Use Download Manual to save a copy."),
        ("Central Wisconsin Map Search", "Use the route tool on Overview or Help. Search an address, property, city, or destination, then open it in Google Maps."),
    ]))

    story += section("14. Admin Review And Corrections")
    story.append(p("Admin can review entries, complete mileage for any worker, add missing entries, check Jobber links, review reports, download CSV files, inspect odometer overrides, manage paper sheets, message workers, and update workers or vehicle settings."))
    story.append(feature_table([
        ("What Admin Reviews", "Worker, date, vehicle, Jobber job, property, purpose, odometers, miles, bucket, status, and override reason."),
        ("When To Message Admin", "Wrong vehicle, missing property, wrong Jobber record, paper sheet issue, odometer mismatch, or a correction that you cannot make yourself."),
        ("Why Notes Matter", "Good notes reduce follow-up messages and make reports easier to approve."),
    ]))

    story += section("15. Common Problems")
    story.append(feature_table([
        ("Vehicle Missing", "Choose Other company vehicle and type the exact name. Then message admin so the vehicle list can be updated later."),
        ("Wrong Odometer", "Enter the real start odometer and complete the override reason requested by the app."),
        ("End Odo Error", "End odometer must be greater than or equal to start odometer."),
        ("No Jobber Record", "Use the normal property if the trip is not tied to Jobber. Message admin if a Jobber job should be synced but is missing."),
        ("Property Not Found", "Search by address, property code, house number, or city. If it still does not appear, message admin."),
        ("CSV Looks Missing Data", "Older entries may not have all new Jobber or bucket fields. They should still display gracefully with the information available."),
        ("Jobber Link Error", "Message admin with the job title or screenshot. The Jobber record may have changed or your Jobber permissions may not include that job."),
    ]))

    story.append(PageBreak())
    story += section("16. Quick Checklist Before Saving")
    story.append(numbered([
        "Correct date selected.",
        "Exact vehicle or fleet unit selected.",
        "Other company vehicle name typed clearly if the vehicle is not listed.",
        "Jobber job, visit, or timesheet selected when the trip is for Jobber work.",
        "Normal property selected when there is no Jobber record.",
        "Start odometer matches the shared odometer, or an override reason is entered.",
        "End odometer is correct.",
        "Purpose or note explains the trip clearly.",
        "Total Miles looks reasonable before saving.",
    ]))
    story.append(callout("The cleanest entry has the right vehicle, the right work record, matching odometer flow, and a note that makes sense later.", GREEN))

    story += section("17. What New Workers Should Know")
    story.append(feature_table([
        ("Company Vehicles", "They should appear automatically in the dropdown after the worker account/profile is ready."),
        ("Personal Vehicle", "Only your own personal vehicle should appear for you."),
        ("Other Personal Vehicles", "You should not see other workers' personal vehicles."),
        ("First Company Trip", "A company vehicle with no saved odometer history starts at 0. Enter the real odometer and save with a clear note if needed."),
        ("Ask Early", "If anything looks wrong on your first day, use Messages so admin can fix the setup before more entries are added."),
    ]))
    story.append(Spacer(1, 0.25 * inch))
    story.append(HRFlowable(width="100%", thickness=0.75, color=colors.HexColor("#cbd5e1")))
    story.append(Spacer(1, 0.15 * inch))
    story.append(p("End of manual. Contact admin if something in the app does not match your work situation.", "Small"))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


if __name__ == "__main__":
    build_manual()
