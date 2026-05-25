import os
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

# Directory where resumes will be generated
OUTPUT_DIR = "/Users/ayaanminhas/Desktop/Jobest/sample_resumes"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def generate_resume(filename, candidate_name, role, email, phone, website, summary, experience, education, skills):
    filepath = os.path.join(OUTPUT_DIR, filename)
    doc = SimpleDocTemplate(filepath, pagesize=letter, rightMargin=54, leftMargin=54, topMargin=54, bottomMargin=54)
    story = []
    
    # Styles Setup
    styles = getSampleStyleSheet()
    
    # Custom Palette
    primary_color = colors.HexColor("#1e3a8a")  # Deep Blue
    text_color = colors.HexColor("#334155")     # Slate 700
    line_color = colors.HexColor("#cbd5e1")     # Slate 300
    
    # Typography Styles
    title_style = ParagraphStyle(
        'NameStyle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=primary_color,
        spaceAfter=4
    )
    
    subtitle_style = ParagraphStyle(
        'SubtitleStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#475569"),
        spaceAfter=12
    )
    
    contact_style = ParagraphStyle(
        'ContactStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#64748b")
    )
    
    section_title_style = ParagraphStyle(
        'SectionTitleStyle',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=primary_color,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'BodyStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=text_color,
        spaceAfter=8
    )
    
    job_header_style = ParagraphStyle(
        'JobHeaderStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=2
    )
    
    bullet_style = ParagraphStyle(
        'BulletStyle',
        parent=body_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=4
    )

    # 1. Header Section
    story.append(Paragraph(candidate_name, title_style))
    story.append(Paragraph(role, subtitle_style))
    
    # Contact grid (using a reportlab Table for clean layout)
    contact_text = f"<b>Email:</b> {email}  |  <b>Phone:</b> {phone}  |  <b>Website:</b> {website}"
    story.append(Paragraph(contact_text, contact_style))
    story.append(Spacer(1, 15))
    
    # Horizontal line helper
    def add_divider():
        t = Table([['']], colWidths=[504])
        t.setStyle(TableStyle([
            ('LINEBELOW', (0,0), (-1,-1), 1, line_color),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
        ]))
        story.append(t)
        story.append(Spacer(1, 10))

    add_divider()
    
    # 2. Executive Summary
    story.append(Paragraph("Professional Summary", section_title_style))
    story.append(Paragraph(summary, body_style))
    story.append(Spacer(1, 8))
    
    # 3. Core Competencies & Skills
    story.append(Paragraph("Skills & Technologies", section_title_style))
    skills_text = ", ".join(skills)
    story.append(Paragraph(f"<b>Technical Stack:</b> {skills_text}", body_style))
    story.append(Spacer(1, 8))
    
    # 4. Professional Experience
    story.append(Paragraph("Professional Experience", section_title_style))
    for job in experience:
        header = f"<b>{job['title']}</b> at <i>{job['company']}</i> ({job['period']})"
        story.append(Paragraph(header, job_header_style))
        for bullet in job['bullets']:
            story.append(Paragraph(f"&bull; {bullet}", bullet_style))
        story.append(Spacer(1, 6))
    
    # 5. Education
    story.append(Paragraph("Education", section_title_style))
    for edu in education:
        edu_text = f"<b>{edu['degree']}</b> - {edu['school']} ({edu['year']})"
        story.append(Paragraph(edu_text, body_style))
        
    # Build the document
    doc.build(story)
    print(f"Generated PDF: {filepath}")

# Define sample datasets
resumes_data = [
    {
        "filename": "Alex_Rivera_Backend_Developer.pdf",
        "candidate_name": "Alex Rivera",
        "role": "Senior Backend Developer",
        "email": "alex.rivera@techmail.io",
        "phone": "+1 (555) 432-1098",
        "website": "github.com/alexrivera-codes",
        "summary": "Highly motivated Senior Backend Engineer with over 6 years of expertise architecting high-performance API services, database structures, and cloud-native solutions. Experienced in developing secure, modular Microservices using Python, FastAPI, and robust PostgreSQL schemas. Skilled in Docker containerization and AWS infrastructure.",
        "skills": ["Python", "FastAPI", "PostgreSQL", "Redis", "Docker", "AWS", "gRPC", "Microservices", "RESTful APIs", "Kubernetes", "Linux"],
        "experience": [
            {
                "title": "Senior Software Engineer (Backend)",
                "company": "CloudForge Solutions",
                "period": "2023 - Present",
                "bullets": [
                    "Led the redesign of the core billing API using FastAPI, yielding a 45% reduction in request latency and processing 10M+ daily events.",
                    "Designed and implemented high-volume data models using PostgreSQL and optimized complex queries, saving 15 hours of database scaling overhead per week.",
                    "Built secure container orchestration flows using Docker and Kubernetes, migrating 12 legacy services to a unified microservices network."
                ]
            },
            {
                "title": "Backend Developer",
                "company": "AppStream Labs",
                "period": "2020 - 2023",
                "bullets": [
                    "Constructed backend microservices in Python using Django and Flask, integrating 5+ major payment gateway systems securely.",
                    "Managed Redis caching layers that reduced heavy read query loads on relational databases by 60%.",
                    "Configured and maintained CI/CD automated deployment pipelines targeting AWS ECS."
                ]
            }
        ],
        "education": [
            {
                "degree": "M.S. in Computer Science",
                "school": "University of Texas at Austin",
                "year": "2020"
            },
            {
                "degree": "B.S. in Software Engineering",
                "school": "Texas A&M University",
                "year": "2018"
            }
        ]
    },
    {
        "filename": "Sofia_Chen_Frontend_Engineer.pdf",
        "candidate_name": "Sofia Chen",
        "role": "Lead Frontend Architect",
        "email": "sofia.chen@uicraft.dev",
        "phone": "+1 (555) 890-5432",
        "website": "sofiachen.dev",
        "summary": "Creative and visually-driven Lead Frontend Architect with 7+ years of experience designing premium, responsive web interfaces and design systems. Specialized in React, TypeScript, Next.js, TailwindCSS, and fluid animations using Framer Motion. Committed to accessibility (WCAG), performance optimization (Core Web Vitals), and clean modular engineering.",
        "skills": ["React", "TypeScript", "Next.js", "TailwindCSS", "Framer Motion", "GraphQL", "Webpack", "A11y (WCAG)", "Jest", "Git", "Redux Toolkit"],
        "experience": [
            {
                "title": "Lead Frontend Architect",
                "company": "DesignSphere Innovations",
                "period": "2022 - Present",
                "bullets": [
                    "Spearheaded the development of a Next.js 15 enterprise SaaS dashboard interface, leading to a 32% increase in user retention and premium conversion.",
                    "Engineered a responsive, custom design system using TailwindCSS and TypeScript components, cutting frontend delivery timeline by 40% across 5 product teams.",
                    "Optimized Largest Contentful Paint (LCP) and Interaction to Next Paint (INP) across pages, achieving perfect 100/100 Lighthouse performance scores."
                ]
            },
            {
                "title": "Senior UI Engineer",
                "company": "PixelPerfect Labs",
                "period": "2019 - 2022",
                "bullets": [
                    "Developed interactive single-page applications in React and TypeScript, leveraging Framer Motion for high-fidelity animations and page transitions.",
                    "Configured Apollo GraphQL query layers that unified communication between complex microservices and UI views.",
                    "Implemented comprehensive unit testing suites using Jest and React Testing Library, boosting code coverage to 92%."
                ]
            }
        ],
        "education": [
            {
                "degree": "B.S. in Computer Science & Interactive Design",
                "school": "Stanford University",
                "year": "2019"
            }
        ]
    },
    {
        "filename": "Marcus_Vance_Fullstack_Dev.pdf",
        "candidate_name": "Marcus Vance",
        "role": "Senior Full-Stack Engineer",
        "email": "marcus.vance@vancecodes.com",
        "phone": "+1 (555) 765-4321",
        "website": "marcusvance.com",
        "summary": "Versatile and business-minded Senior Full-Stack Engineer with 5+ years of experience constructing robust, secure end-to-end applications. Proficient across the entire stack, from database optimization (PostgreSQL, MongoDB) to backend logic (Node.js, Express) and frontend experiences (React, TailwindCSS). Passionate about devops best practices and AWS orchestration.",
        "skills": ["React", "Node.js", "Express", "PostgreSQL", "MongoDB", "TailwindCSS", "AWS", "Docker", "REST APIs", "CI/CD", "TypeScript", "Linux"],
        "experience": [
            {
                "title": "Senior Full-Stack Engineer",
                "company": "SynergyTech Products",
                "period": "2023 - Present",
                "bullets": [
                    "Architected and deployed a multi-tenant client onboarding portal using Node.js, Express, React, and PostgreSQL, supporting 50,000+ active businesses.",
                    "Containerized entire development and staging environments using Docker, cutting developer onboarding times from 2 days to 15 minutes.",
                    "Orchestrated cloud migration to AWS, leveraging ECS, RDS, and S3 to reduce infrastructure hosting costs by 28%."
                ]
            },
            {
                "title": "Software Engineer II",
                "company": "WebGrid Solutions",
                "period": "2021 - 2023",
                "bullets": [
                    "Maintained and enhanced core web products using Express, MongoDB, and React, developing 20+ reusable backend routes and matching UI views.",
                    "Refactored styling pipelines using TailwindCSS to enforce mobile-first design and accessibility consistency.",
                    "Created automated integrations with SendGrid, Stripe, and Twilio, enabling streamlined messaging and billing flows."
                ]
            }
        ],
        "education": [
            {
                "degree": "B.S. in Computer Science",
                "school": "Georgia Institute of Technology",
                "year": "2021"
            }
        ]
    },
    {
        "filename": "Jane_Doe_React_Developer.pdf",
        "candidate_name": "Jane Doe",
        "role": "Senior React Developer",
        "email": "jane.doe@reactmail.org",
        "phone": "+1 (555) 123-4567",
        "website": "github.com/janedoe-ui",
        "summary": "Experienced and detail-oriented Senior React Developer with 6 years of expertise building scalable, premium SaaS dashboard interfaces. Exceptional command of React, TypeScript, Redux, and TailwindCSS. Experienced in setting up clean modular folder structures and responsive typography, with strong open-source contribution.",
        "skills": ["React", "TypeScript", "TailwindCSS", "Redux Toolkit", "REST APIs", "Git", "Webpack", "CSS Grid/Flexbox", "Responsive Design", "A11y"],
        "experience": [
            {
                "title": "Senior React Developer",
                "company": "SaaSFlow Interfaces",
                "period": "2022 - Present",
                "bullets": [
                    "Engineered 50+ reusable high-fidelity React UI components with TypeScript and TailwindCSS, reducing duplicate stylesheet lines by 30%.",
                    "Integrated comprehensive REST API client wrappers with Redux Toolkit for unified application caching and global state management.",
                    "Spearheaded mobile-responsive refactoring, ensuring pixel-perfect layout renderings across 10+ standard viewport devices."
                ]
            },
            {
                "title": "UI Engineer",
                "company": "CoreGrid Software",
                "period": "2020 - 2022",
                "bullets": [
                    "Constructed interactive frontend dashboard panels utilizing React, Chart.js, and CSS variables for smooth light/dark theme toggles.",
                    "Maintained Git repository branches and coordinated regular peer code reviews, improving overall product quality and adherence to guidelines.",
                    "Developed mock servers and client-side endpoints to ensure rapid layout validation during early prototyping stages."
                ]
            }
        ],
        "education": [
            {
                "degree": "B.S. in Information Technology",
                "school": "Georgia State University",
                "year": "2020"
            }
        ]
    }
]

if __name__ == "__main__":
    print(f"Beginning sample PDF generation to: {OUTPUT_DIR}")
    for item in resumes_data:
        generate_resume(
            filename=item["filename"],
            candidate_name=item["candidate_name"],
            role=item["role"],
            email=item["email"],
            phone=item["phone"],
            website=item["website"],
            summary=item["summary"],
            experience=item["experience"],
            education=item["education"],
            skills=item["skills"]
        )
    print("\nAll 4 resumes generated successfully!")
