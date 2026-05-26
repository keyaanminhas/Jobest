from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas


OUTPUT_DIR = Path(r"C:\Users\Keyaan\Documents\code\AI Marathon Hackathon\Demo CV Pack")


CANDIDATES = [
    {
        "filename": "01_Amir_Qureshi_CV.pdf",
        "name": "Amir Qureshi",
        "title": "Embedded Robotics Engineer",
        "location": "Karachi, Pakistan",
        "email": "amir.qureshi.demo@example.com",
        "phone": "+92 300 111 2201",
        "links": [
            "github.com/amirqureshi-robotics",
            "amir-embedded.dev",
        ],
        "summary": (
            "Embedded robotics engineer with hands-on Arduino and ESP32 experience building line-following robots, "
            "sensor-driven automation systems, and control logic in C++. Comfortable with rapid prototyping, field testing, and debugging."
        ),
        "skills": [
            "Arduino",
            "ESP32",
            "C++",
            "Motor and sensor integration",
            "Embedded debugging",
            "Prototype testing",
            "React",
            "Node.js",
        ],
        "experience": [
            "Built and tuned two line-following robots for university competitions using C++ control logic and IR sensor calibration.",
            "Integrated ESP32 motor drivers, ultrasonic sensors, and telemetry dashboards for a warehouse robotics prototype.",
            "Developed a lightweight Node.js API and React dashboard for testing robot runs and logging sensor behaviour.",
        ],
        "projects": [
            "Autonomous cart prototype using ESP32, PID-style tuning, and motor encoder feedback.",
            "Workshop management web app for hardware issue tracking and test result logging.",
        ],
    },
    {
        "filename": "02_Sofia_Tan_CV.pdf",
        "name": "Sofia Tan",
        "title": "Junior Mechatronics Software Developer",
        "location": "Kuala Lumpur, Malaysia",
        "email": "sofia.tan.demo@example.com",
        "phone": "+60 12 550 2202",
        "links": [
            "github.com/sofiatan-dev",
            "sofiasystems.site",
        ],
        "summary": (
            "Computer science graduate focused on robotics software, embedded C++, and prototype validation. "
            "Combines microcontroller work with practical web tooling for hardware teams."
        ),
        "skills": [
            "Arduino",
            "ESP32",
            "C++",
            "JavaScript",
            "RESTful APIs",
            "React",
            "Flutter",
            "SQL",
        ],
        "experience": [
            "Implemented obstacle-avoidance logic and motor control tuning for an educational robot kit using Arduino.",
            "Created internal dashboards in React for test-session playback, issue reporting, and experiment notes.",
            "Worked with technicians to debug wiring faults, noisy sensors, and intermittent power issues during prototype demos.",
        ],
        "projects": [
            "Smart greenhouse controller with sensor monitoring, irrigation triggers, and web-based configuration.",
            "Mobile app for robotics club inventory, diagnostics, and field-test reports.",
        ],
    },
    {
        "filename": "03_Haroon_Malik_CV.pdf",
        "name": "Haroon Malik",
        "title": "Robotics Software and Controls Engineer",
        "location": "Lahore, Pakistan",
        "email": "haroon.m.demo@example.com",
        "phone": "+92 301 333 2203",
        "links": [
            "github.com/haroon-controls",
            "haroon-builds.dev",
        ],
        "summary": (
            "Robotics-focused engineer with hands-on control-system implementation, embedded software, and rapid prototype iteration. "
            "Experience spans combat robots, test rigs, and simulation-assisted tuning."
        ),
        "skills": [
            "Arduino",
            "C++",
            "Motor and sensor integration",
            "Prototype testing",
            "Embedded debugging",
            "Documentation",
            "Simulation tools",
            "Node.js",
        ],
        "experience": [
            "Led software integration for a combat robot project with actuator control, safety cutoffs, and repair-ready modular wiring.",
            "Ran repeated track and field tests to improve movement stability and detect edge-case failures under timing pressure.",
            "Maintained test documentation and issue logs for multi-week hardware and firmware iteration cycles.",
        ],
        "projects": [
            "Combat robot actuator controller with failsafe logic and telemetry output.",
            "Node.js-based run logger for prototype diagnostics and benchmark comparison.",
        ],
    },
    {
        "filename": "04_Zara_Ahmad_CV.pdf",
        "name": "Zara Ahmad",
        "title": "Software Engineer with Embedded Systems Exposure",
        "location": "Islamabad, Pakistan",
        "email": "zara.ahmad.demo@example.com",
        "phone": "+92 302 440 2204",
        "links": [
            "github.com/zara-ahmad",
            "zara-devfolio.com",
        ],
        "summary": (
            "Software engineer with solid JavaScript and React experience plus practical exposure to Arduino-based robotics builds, "
            "sensor debugging, and field-test iteration."
        ),
        "skills": [
            "JavaScript",
            "React",
            "Node.js",
            "RESTful APIs",
            "Arduino",
            "Prototype testing",
            "SQL",
            "Documentation",
        ],
        "experience": [
            "Shipped internal web tools for engineering teams managing prototype runs and maintenance records.",
            "Supported Arduino robot testing for a student robotics programme, with focus on logging, bug triage, and operator workflows.",
            "Worked on API integrations and frontend dashboards for field devices reporting sensor values in real time.",
        ],
        "projects": [
            "React quality dashboard for robotics lab checklists and run history.",
            "REST API for experiment records and device health snapshots.",
        ],
    },
    {
        "filename": "05_Ryan_Wong_CV.pdf",
        "name": "Ryan Wong",
        "title": "Embedded Systems and Automation Developer",
        "location": "Penang, Malaysia",
        "email": "ryan.wong.demo@example.com",
        "phone": "+60 11 880 2205",
        "links": [
            "github.com/ryanw-embedded",
            "ryanproto.dev",
        ],
        "summary": (
            "Automation developer with embedded software experience on ESP32 platforms, motor control, sensor integration, and practical debugging. "
            "Comfortable supporting both firmware and connected software interfaces."
        ),
        "skills": [
            "ESP32",
            "C++",
            "Arduino",
            "Motor and sensor integration",
            "Embedded debugging",
            "React",
            "Node.js",
            "FreeRTOS",
        ],
        "experience": [
            "Developed ESP32-based automation modules with sensor polling, event triggers, and actuator response logic.",
            "Built web views for monitoring system state, logs, and deployment notes for field technicians.",
            "Assisted in prototype assembly, failure analysis, and repeatability testing across multiple device revisions.",
        ],
        "projects": [
            "Factory feeder prototype with motor control sequencing and sensor-based stop conditions.",
            "Monitoring dashboard for live device telemetry and debugging checkpoints.",
        ],
    },
    {
        "filename": "06_Amina_Rahman_CV.pdf",
        "name": "Amina Rahman",
        "title": "Junior Robotics Engineer",
        "location": "Dhaka, Bangladesh",
        "email": "amina.rahman.demo@example.com",
        "phone": "+880 171 220 2206",
        "links": [
            "github.com/amina-rh",
        ],
        "summary": (
            "Junior robotics engineer with hands-on university project experience in line-following bots, embedded C++, and hardware iteration. "
            "Strong willingness to grow in production engineering environments."
        ),
        "skills": [
            "Arduino",
            "C++",
            "Prototype testing",
            "Sensor calibration",
            "Documentation",
            "JavaScript",
            "Git",
        ],
        "experience": [
            "Contributed to robotics competition builds with line detection logic and troubleshooting under time constraints.",
            "Documented wiring, firmware updates, and track-test observations for student team handovers.",
            "Created simple JavaScript tools for comparing calibration values and recording repeated test runs.",
        ],
        "projects": [
            "Line-following robot with threshold tuning and repeated course testing.",
            "Calibration comparison utility for student robotics workshops.",
        ],
    },
    {
        "filename": "07_Daniel_Lee_CV.pdf",
        "name": "Daniel Lee",
        "title": "Frontend and Platform Engineer",
        "location": "Singapore",
        "email": "daniel.lee.demo@example.com",
        "phone": "+65 9123 2207",
        "links": [
            "github.com/danlee-platform",
            "danlee.dev",
        ],
        "summary": (
            "Frontend and platform engineer with strong React, Node.js, and REST API delivery experience. "
            "Limited robotics exposure but solid engineering discipline and shipped product work."
        ),
        "skills": [
            "JavaScript",
            "React",
            "Node.js",
            "RESTful APIs",
            "SQL",
            "Documentation",
            "Linux",
            "Git",
        ],
        "experience": [
            "Built production web features, admin tools, and API integrations for client-facing education platforms.",
            "Owned release workflows, issue triage, and documentation for cross-functional feature rollouts.",
            "Supported simple microcontroller demonstrations during internal hackathons but not core embedded work.",
        ],
        "projects": [
            "Multi-tenant admin panel for configuration, analytics, and support workflows.",
            "API service for scheduling, reporting, and user access logic.",
        ],
    },
    {
        "filename": "08_Hiba_Siddiqui_CV.pdf",
        "name": "Hiba Siddiqui",
        "title": "Mobile and Web Engineer",
        "location": "Karachi, Pakistan",
        "email": "hiba.s.demo@example.com",
        "phone": "+92 304 552 2208",
        "links": [
            "github.com/hiba-siddiqui",
            "hibaapps.dev",
        ],
        "summary": (
            "Mobile and web engineer with Flutter, React, and API integration experience, plus some exposure to Arduino hardware demos and IoT side projects."
        ),
        "skills": [
            "Flutter",
            "Dart",
            "React",
            "Node.js",
            "RESTful APIs",
            "SQL",
            "Arduino",
        ],
        "experience": [
            "Delivered mobile apps for education and operations use cases with production deployment experience.",
            "Built dashboards and backend services used by real clients and internal teams.",
            "Completed Arduino-based IoT projects involving sensors and simple device control for coursework.",
        ],
        "projects": [
            "Student operations mobile app with backend integration and reporting.",
            "Arduino temperature monitor with mobile status screens and alert logic.",
        ],
    },
    {
        "filename": "09_Omar_Hassan_CV.pdf",
        "name": "Omar Hassan",
        "title": "Controls and Simulation Intern",
        "location": "Cairo, Egypt",
        "email": "omar.hassan.demo@example.com",
        "phone": "+20 101 220 2209",
        "links": [
            "github.com/omarh-controls",
        ],
        "summary": (
            "Early-career controls engineer with exposure to simulation tools, documentation, and firmware labs. "
            "Good theoretical grounding, lighter real-world deployment record."
        ),
        "skills": [
            "C++",
            "Simulation tools",
            "Documentation",
            "Control systems",
            "Python",
            "Linux",
        ],
        "experience": [
            "Assisted in simulation-based tuning exercises for autonomous movement coursework.",
            "Prepared lab notes, test plans, and performance summaries for student projects.",
            "Worked with Python scripts for data logging and result analysis.",
        ],
        "projects": [
            "Simulation-first robot navigation assignment with path tuning.",
            "Python data analysis notebook for motor response measurements.",
        ],
    },
    {
        "filename": "10_Sara_Khan_CV.pdf",
        "name": "Sara Khan",
        "title": "Product Software Engineer",
        "location": "Lahore, Pakistan",
        "email": "sara.k.demo@example.com",
        "phone": "+92 305 660 2210",
        "links": [
            "github.com/sarakhan-dev",
            "sarakhan.software",
        ],
        "summary": (
            "Product software engineer with strong React, Node.js, SQL, and REST API skills. "
            "Excellent shipped software experience but no direct robotics background."
        ),
        "skills": [
            "JavaScript",
            "React",
            "Node.js",
            "RESTful APIs",
            "SQL",
            "Documentation",
            "Git",
            "Linux",
        ],
        "experience": [
            "Led delivery of web applications used by education and service businesses with high user adoption.",
            "Owned backend API integrations, testing coordination, and production support workflows.",
            "Worked in small product teams with fast iteration and tight feedback loops.",
        ],
        "projects": [
            "Operations suite for admissions, scheduling, and analytics.",
            "Client dashboard with API-driven content and role-based access control.",
        ],
    },
    {
        "filename": "11_Ibrahim_Ali_CV.pdf",
        "name": "Ibrahim Ali",
        "title": "Firmware Trainee",
        "location": "Rawalpindi, Pakistan",
        "email": "ibrahim.ali.demo@example.com",
        "phone": "+92 306 771 2211",
        "links": [
            "github.com/ibrahim-firmware",
        ],
        "summary": (
            "Firmware trainee with basic Arduino and ESP32 knowledge, some C++ coursework, and hands-on lab testing. "
            "Needs mentoring for production-level work."
        ),
        "skills": [
            "Arduino",
            "ESP32",
            "C++",
            "Prototype testing",
            "Documentation",
        ],
        "experience": [
            "Completed firmware labs covering sensor reads, digital outputs, and serial debugging.",
            "Helped assemble and test simple embedded kits for classroom demos.",
            "Maintained step-by-step setup notes and issue checklists for peers.",
        ],
        "projects": [
            "Basic obstacle alert bot using Arduino and ultrasonic sensing.",
            "ESP32 classroom monitor demo with serial logging.",
        ],
    },
    {
        "filename": "12_Priya_Sharma_CV.pdf",
        "name": "Priya Sharma",
        "title": "Automation QA and Tooling Engineer",
        "location": "Bengaluru, India",
        "email": "priya.sharma.demo@example.com",
        "phone": "+91 98450 2212",
        "links": [
            "github.com/priyasharma-tools",
            "priyatesting.dev",
        ],
        "summary": (
            "Automation-focused engineer with strong debugging habits, QA discipline, and internal tool development experience. "
            "Some overlap with hardware validation, limited embedded implementation depth."
        ),
        "skills": [
            "JavaScript",
            "Node.js",
            "Documentation",
            "Prototype testing",
            "RESTful APIs",
            "SQL",
            "Python",
        ],
        "experience": [
            "Built internal test tooling and issue dashboards for hardware-adjacent product teams.",
            "Coordinated prototype validation checklists and reproduced edge cases from field reports.",
            "Maintained detailed issue documentation, runbooks, and regression tracking systems.",
        ],
        "projects": [
            "QA dashboard for field-device validation cycles.",
            "Python utility for parsing test logs and generating summaries.",
        ],
    },
    {
        "filename": "13_Mehreen_Asif_CV.pdf",
        "name": "Mehreen Asif",
        "title": "Cybersecurity and Scripting Intern",
        "location": "Islamabad, Pakistan",
        "email": "mehreen.asif.demo@example.com",
        "phone": "+92 307 882 2213",
        "links": [
            "github.com/mehreen-sec",
        ],
        "summary": (
            "Cybersecurity-oriented intern with Python scripting and systems exposure. "
            "Useful for contrast in rankings because the background is technical but not robotics-focused."
        ),
        "skills": [
            "Python",
            "Linux",
            "Documentation",
            "Git",
            "SQL",
        ],
        "experience": [
            "Worked on scripting, log review, and documentation in a student security lab environment.",
            "Created small utilities for parsing data and improving repeatable analysis steps.",
            "Participated in technical competitions and workshop-based learning.",
        ],
        "projects": [
            "Python tooling for log normalization and event summaries.",
            "Security note repository with scripts and issue templates.",
        ],
    },
    {
        "filename": "14_Alex_Chen_CV.pdf",
        "name": "Alex Chen",
        "title": "Systems Software Intern",
        "location": "Johor Bahru, Malaysia",
        "email": "alex.chen.demo@example.com",
        "phone": "+60 17 990 2214",
        "links": [
            "github.com/alexc-systems",
            "alexsystems.dev",
        ],
        "summary": (
            "Systems software intern with C++, Linux, and debugging exposure plus some firmware lab work. "
            "Good engineering fundamentals, modest robotics project depth."
        ),
        "skills": [
            "C++",
            "Linux",
            "Git",
            "Documentation",
            "Python",
            "Arduino",
        ],
        "experience": [
            "Assisted with systems debugging and reproducible issue isolation for internal engineering builds.",
            "Worked on C++ assignments involving state handling, device simulation, and test harnesses.",
            "Completed microcontroller labs using Arduino and documented hardware setup steps.",
        ],
        "projects": [
            "C++ diagnostics harness for simulated device behaviour.",
            "Arduino sensor lab with structured setup and troubleshooting notes.",
        ],
    },
    {
        "filename": "15_Nadia_Javed_CV.pdf",
        "name": "Nadia Javed",
        "title": "Junior Full Stack Developer",
        "location": "Karachi, Pakistan",
        "email": "nadia.j.demo@example.com",
        "phone": "+92 308 993 2215",
        "links": [
            "github.com/nadiaj-dev",
            "nadiajaved.dev",
        ],
        "summary": (
            "Junior full stack developer with practical web and mobile delivery experience. "
            "Strong product execution, but limited embedded or robotics exposure."
        ),
        "skills": [
            "JavaScript",
            "React",
            "Node.js",
            "RESTful APIs",
            "Flutter",
            "SQL",
            "Documentation",
        ],
        "experience": [
            "Built and maintained client-facing apps with API integrations, dashboards, and content management workflows.",
            "Worked directly with stakeholders to ship usable features quickly and iterate from feedback.",
            "Supported some hardware-adjacent school projects but not core embedded engineering work.",
        ],
        "projects": [
            "Mobile education app with backend integration and reporting features.",
            "Admin panel for content updates, analytics, and workflow tracking.",
        ],
    },
]


def wrap_text(pdf: canvas.Canvas, text: str, width: float, font_name: str, font_size: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = word if not current else f"{current} {word}"
        if pdf.stringWidth(trial, font_name, font_size) <= width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_section_title(pdf: canvas.Canvas, title: str, x: float, y: float) -> float:
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(x, y, title)
    pdf.setLineWidth(0.6)
    pdf.line(x, y - 2, 190 * mm, y - 2)
    return y - 14


def draw_paragraph(pdf: canvas.Canvas, text: str, x: float, y: float, width: float, font_size: int = 9, leading: int = 12) -> float:
    pdf.setFont("Helvetica", font_size)
    for line in wrap_text(pdf, text, width, "Helvetica", font_size):
        pdf.drawString(x, y, line)
        y -= leading
    return y


def draw_bullets(pdf: canvas.Canvas, items: list[str], x: float, y: float, width: float) -> float:
    pdf.setFont("Helvetica", 9)
    for item in items:
        lines = wrap_text(pdf, item, width - 10, "Helvetica", 9)
        for idx, line in enumerate(lines):
            prefix = "- " if idx == 0 else "  "
            pdf.drawString(x, y, prefix + line)
            y -= 12
        y -= 2
    return y


def build_pdf(data: dict) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUTPUT_DIR / data["filename"]
    pdf = canvas.Canvas(str(path), pagesize=A4)
    width, height = A4
    x = 18 * mm
    y = height - 20 * mm
    content_width = width - 36 * mm

    pdf.setTitle(data["name"])
    pdf.setAuthor("Jobest Demo Pack")

    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawString(x, y, data["name"])
    y -= 16
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(x, y, data["title"])
    y -= 14
    pdf.setFont("Helvetica", 9)
    pdf.drawString(x, y, f"{data['location']} | {data['email']} | {data['phone']}")
    y -= 12
    pdf.drawString(x, y, " | ".join(data["links"]))
    y -= 18

    y = draw_section_title(pdf, "Professional Summary", x, y)
    y = draw_paragraph(pdf, data["summary"], x, y, content_width)
    y -= 6

    y = draw_section_title(pdf, "Technical Skills", x, y)
    y = draw_paragraph(pdf, ", ".join(data["skills"]), x, y, content_width)
    y -= 6

    y = draw_section_title(pdf, "Experience Highlights", x, y)
    y = draw_bullets(pdf, data["experience"], x, y, content_width)

    if y < 80:
        pdf.showPage()
        y = height - 20 * mm

    y = draw_section_title(pdf, "Selected Projects", x, y)
    y = draw_bullets(pdf, data["projects"], x, y, content_width)

    y -= 6
    y = draw_section_title(pdf, "Education", x, y)
    education = (
        "Bachelor-level Computer Science or Engineering background with project-based robotics, embedded, "
        "software, or automation exposure through coursework, competitions, freelance work, or internships."
    )
    y = draw_paragraph(pdf, education, x, y, content_width)

    pdf.setFont("Helvetica-Oblique", 8)
    pdf.drawString(x, 12 * mm, "Synthetic demo resume generated for Jobest product demonstrations.")
    pdf.save()


def main() -> None:
    for candidate in CANDIDATES:
        build_pdf(candidate)
    print(f"Generated {len(CANDIDATES)} demo CV PDFs in {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
