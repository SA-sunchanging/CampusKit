# 2110521 Software Architecture — Course Reference

> Transcribed from the course syllabus dated 19 Oct 2026 (5 pages), which replaces the 3 Aug 2026
> issue. The revision moved topics between weeks 11–14 and changed which lectures each quiz covers;
> all dates stayed the same.
>
> The syllabus gives dates in the Thai Buddhist Era (B.E. 2569 = C.E. 2026). All dates below are
> C.E. Text marked _(derived)_ is the transcriber's inference, not syllabus wording.

## Course facts

| Field | Value |
| --- | --- |
| Course code | 2110521 |
| Name | สถาปัตยกรรมซอฟต์แวร์ (Software Architecture) |
| Credits | 3 (3 h lecture per week, no lab) |
| Department | Computer Engineering (วิศวกรรมคอมพิวเตอร์), Chulalongkorn University |
| Semester | First semester (ภาคต้น), academic year 2569 (2026) |
| Status | Elective (วิชาเลือก) |
| Level | Bachelor's and Master's: B.Eng., M.Sc. Computer Science, M.Sc. Software Engineering |
| Teaching media | Lecture slides and supplementary videos |
| Course platform | MCV (myCourseVille): group registration, the presentation template, and the Zoom link |

### Instructors

The schedule refers to instructors by initials. The mapping from initials to names is _(derived)_.

| Initials | Instructor |
| --- | --- |
| PKV | รศ.ดร.พิตติพล คันธวัฒน์ (course head, หัวหน้ารายวิชา) |
| WWW | ศ.ดร.วิวัฒน์ วัฒนาวุฒิ |
| DW | รศ.ดร.ดวงดาว วิชาดากุล |
| NWT | ผศ.ดร.เนื่องวงศ์ ทวยเจริญ |
| CR | อ. ดร. ชัยยงค์ รักขิตเวชสกุล |

### Objectives

- To introduce software architecture principle
- To survey available software architectural styles
- To practice the software architectural design using styles and patterns
- To exploit the conventional software tools in software architectural design

### Description

Principles of software architectures; practical methods in software architectures using
scenario-based analysis, heuristic, and formal approaches; architectural styles; architectural
description language; software architectural analysis and design; software architectures
specification tools; software architecture-based testing; use of software architectures in the
software development process.

## Grading

| Component | Weight |
| --- | --- |
| Quiz | 10% |
| Assignment from Tutorial | 15% |
| Final exam (สอบปลายภาค) | 25% |
| **Term project** | **50%** |

The term project's 50% breaks down as follows:

| Term project item | Weight |
| --- | --- |
| Project proposal & ADR | 5% + 3% |
| Microservice Design with Collaborations | 2% |
| Project progress 1, 2, 3 (Git contribution counts) | 5% + 5% + 5% |
| Project work product & demo & documentation | 15% + 5% + 5% |

There is no midterm exam. During week 8, the midterm exam week, there are no classes.

## Key dates and deadlines

**Our team attends the Wednesday class.** The syllabus gives
two dates for every week, one for each class day. In the calendar those days are Wednesday and
Sunday. Submission deadlines fall on the Tuesday before the next Wednesday class _(derived)_. The
dates below are for the Wednesday section.

- **Sunday section:** every date is 4 days later.
- **Final exam:** the same for both sections.

"In class" (ส่งในคาบ) means the item is submitted during that class. "End of class" (ส่งท้ายคาบ)
means it is submitted at the end of the class.

| Date (Wed section) | Week | Item | Graded under |
| --- | --- | --- | --- |
| 2026-08-19 (Wed) | 3 | Form a group and create it in MCV | — |
| 2026-08-26 (Wed) | 4 | Quiz 1 (lecture from week 2) | Quiz |
| 2026-08-26 (Wed) | 4 | Term-project topic summary, in class | Term project |
| 2026-08-26 (Wed) | 4 | Project customer group (กลุ่มลูกค้าของ project), in class | Term project |
| **2026-09-08 (Tue)** | 5 | **Microservice Design with Collaborations** | Term project 2% |
| **2026-09-08 (Tue)** | 5 | **Project Proposal and ADR (draft)** | Term project 5% + 3% |
| 2026-09-09 (Wed) | 6 | Quiz 2 (lecture from week 5) | Quiz |
| 2026-09-09 (Wed) | 6 | Assignment 1: develop service(s) from tutorial using REST, in class | Assignment |
| 2026-09-16 (Wed) | 7 | Assignment 2: develop service(s) from tutorial using gRPC, in class | Assignment |
| **2026-09-29 (Tue)** | 8 | **Project progress 1** (video) | Term project 5% |
| 2026-10-07 (Wed) | 10 | Quiz 3 (lectures from weeks 6–7) | Quiz |
| 2026-10-07 (Wed) | 10 | Assignment 3: develop service(s) using message broker, in class | Assignment |
| **2026-10-13 (Tue)** | 10 | **Project progress 2** (video) | Term project 5% |
| 2026-10-14 (Wed) | 11 | Quiz 4 (lecture from week 10) | Quiz |
| 2026-10-14 (Wed) | 11 | Assignment 4: develop an API gateway service, end of class | Assignment |
| 2026-10-21 (Wed) | 12 | Quiz 5 (lecture from week 11) | Quiz |
| 2026-10-21 (Wed) | 12 | Assignment 5: GenAI for ADR generation, end of class | Assignment |
| **2026-10-27 (Tue)** | 12 | **Project progress 3** (video) | Term project 5% |
| 2026-10-28 (Wed) | 13 | Quiz 6 (lecture from week 12) | Quiz |
| 2026-10-28 (Wed) | 13 | Assignment 6: deployment topologies and trade-offs of AI-enabled systems, end of class | Assignment |
| 2026-11-04 (Wed) | 14 | Quiz 7 (lecture from week 13) | Quiz |
| 2026-11-04 (Wed) | 14 | Assignment 7: develop load testing, end of class | Assignment |
| **2026-11-11 (Wed)** | 15 | **Project presentation and live demo** (final work product, demo, documentation) | Term project 15% + 5% + 5% |
| **2026-11-22 (Sun)** | 16 | **Final exam**, held on Sunday for all sections together | Final 25% |

There are no classes on these days:

- 2026-08-12, week 2: Mother's Day
- 2026-09-23, week 8: midterm exam week
- 2026-09-30, week 9: graduation ceremony (วันรับพระราชทานปริญญาบัตร)

Each **project progress submission is a 3–5 minute video clip** that demonstrates the working
software. Git contribution counts toward the progress grade.

## Weekly schedule

This table is the full schedule as the syllabus prints it, with both class dates for each week.
Instructor initials are in brackets.

| Week | Dates (Wed / Sun) | Topics | Assigned / due |
| --- | --- | --- | --- |
| 1 | 08-05 / 08-09 | Overview of Software Architecture (WWW) | — |
| 2 | 08-12 / 08-16 | _Holiday: Mother's Day_ | — |
| 3 | 08-19 / 08-23 | Introduction to Microservice (PKV); Monolith vs Microservice; Decomposition Strategies (PKV); Identifying System Operations & Services | Form group in MCV |
| 4 | 08-26 / 08-30 | Start-up Workshop (NWT) | Quiz 1; term-project topic summary (in class); project customer group (in class) |
| 5 | 09-02 / 09-06 | Architectural Decision Record (ADR) (DW); Domain Driven Design: DDD model (DW); Selecting Service Database (DW) | Microservice Design with Collaborations, and Project Proposal & ADR (draft), due 09-08 / 09-12 |
| 6 | 09-09 / 09-13 | Interprocess Communication (Synchronous): REST (NWT); Tutorial 1: REST (NWT) | Quiz 2; Assignment 1 (REST, in class) |
| 7 | 09-16 / 09-20 | Interprocess Communication (Synchronous): gRPC (NWT); Tutorial 2: gRPC (NWT) | Assignment 2 (gRPC, in class) |
| 8 | 09-23 / 09-27 | _No class: midterm exam week_ | Project progress 1, due 09-29 / 10-03 |
| 9 | 09-30 / 10-04 | _No class: graduation ceremony_ | — |
| 10 | 10-07 / 10-11 | Interprocess Communication (Asynchronous) (DW); Service Discovery; Brokerless vs Broker-based; Implementing message broker (DW); Tutorial 3: Implementing message broker (DW) | Quiz 3; Assignment 3 (message broker, in class); project progress 2, due 10-13 / 10-17 |
| 11 | 10-14 / 10-18 | API composition pattern; External API Pattern (WWW); Implementing an API gateway; Tutorial 4: API Gateway (WWW) | Quiz 4; Assignment 4 (API gateway, end of class) |
| 12 | 10-21 / 10-25 | AI for Software Architecture (AI4SA) (CR): GenAI to generate ADR; automated architectural reconstruction & reverse engineering; GenAI for system design. Tutorial 5: GenAI for ADR generation | Quiz 5; Assignment 5 (GenAI for ADR, end of class); project progress 3, due 10-27 / 10-31 |
| 13 | 10-28 / 11-01 | Software Architecture of AI-enabled System (CR): deployment topologies & trade-offs of AI-enabled systems; LLM orchestration & RAG patterns; architecture for telemetry & silent failures. Tutorial 7: implement a simple AI-system architecture pattern | Quiz 6; Assignment 6 (AI deployment topologies, end of class) |
| 14 | 11-04 / 11-08 | Implementing queries (PKV); Deploying Microservices (PKV); Testing Microservice (PKV); Tutorial 6: Testing Microservice (PKV) | Quiz 7; Assignment 7 (load testing, end of class) |
| 15 | 11-11 / 11-15 | **Project Presentation** | — |
| 16 | 11-22 (Sun) | **Final exam** (all sections, Sunday) | — |

## Term project requirements

The syllabus states the requirements twice, in two lists with slightly different wording. Both are
transcribed below, followed by a merged checklist.

### Minimum requirements (syllabus "Term Project details", verbatim)

> - There are at lease 3 business use cases (+ authentication) with front-end UI (for demonstration).
> - Consist of at least following back-end microservice components:
>   - one service (or more) with REST
>   - one service (or more) with gRPC
>   - one service (or more) with message broker
>   - API gateway service
> - Describes how to manage Service Discovery.
> - Conduct at least 2 types of databases (both RDBMS and No-SQL).
> - Conduct a load test (at least 2 types) and explain the results.
> - Conduct and explain Risk Matrix.
> - Demonstrate at lease 1 issue in SW Quality and measurement. (ex. Scalability, Reusability, Maintainability, Security)

### Presentation content requirements (Presentation & Submission Guidelines, "Content Requirements", verbatim)

> **Part 1: System Architecture Overview.** Use the **C4 Model** to describe your system's
> architecture through four levels and supplement with **sequence diagram**.
>
> **Part 2: Implementation & Demonstration.** Demonstrate your **working system** and explain key
> architectural and quality-related aspects. Include the following:
> - At least **3 business use cases** and **authentication**
> - **Live demo of the front-end UI** (no recorded videos)
> - Back-end architecture must include:
>   - At least one **REST API**
>   - At least one **gRPC service**
>   - At least one **Message Broker-based service**
>   - An **API Gateway**
> - Describe the **Service Discovery mechanism**
> - Use **at least two types of databases**: one relational (RDBMS) and one NoSQL
> - Conduct a **Load Test** and interpret the results
> - Conduct and Explain **Risk Matrix (at least 3 issues)**
> - Present and explain **1 measurable Quality Attribute**, such as: Scalability, Resilience, Performance, Observability

### Merged checklist

Where the two lists differ, this checklist takes the stricter reading. The "Taught in" column gives
the week whose lecture covers each topic _(derived)_.

| Requirement | Taught in | Notes |
| --- | --- | --- |
| At least 3 business use cases, **plus** authentication | W3–W4 | Authentication does not count toward the 3. |
| Front-end UI, demonstrated **live** at the final presentation | — | Recorded videos are not allowed at the final presentation. Progress submissions *are* videos. |
| At least 1 back-end microservice exposing **REST** | W6 | |
| At least 1 back-end microservice using **gRPC** | W7 | |
| At least 1 back-end microservice using a **message broker** | W10 | |
| An **API gateway** service | W11 | |
| **Service discovery**: describe how it is managed | W10 | Must be explained in the presentation. |
| At least 2 database types: **one RDBMS and one NoSQL** | W5 (Selecting Service Database) | |
| **Load test**: at least **2 types**, with the results explained and interpreted | W14 | The minimum requirements ask for at least 2 types. The presentation guidelines give no count. Do 2. |
| **Risk matrix**: at least 3 issues, explained | — | The count comes from the presentation guidelines. |
| **1 measurable quality attribute**, demonstrated and measured | — | Minimum-requirements examples: Scalability, Reusability, Maintainability, Security. Presentation-guidelines examples: Scalability, Resilience, Performance, Observability. Scalability appears in both lists. |
| **C4 model**, all four levels (Context, Container, Component, Code), plus sequence diagram(s) | — | In the final slides. |
| ADRs | W5 | Graded with the proposal (3%). Week 12 covers using GenAI to generate ADRs. |
| Git contribution from every member | — | Counted in progress 1–3. |

### Deliverable formats

| Deliverable | Format and rules |
| --- | --- |
| Term-project topic summary; customer group | Submitted in class, week 4 |
| Project proposal & ADR (draft) | Due 2026-09-08 |
| Microservice Design with Collaborations | Due 2026-09-08 |
| Project progress 1–3 | **Video clip, 3–5 minutes**, demonstrating the working software |
| Final documentation | **No separate written report.** Use the presentation template on MCV. The slides hold all required content and are the final deliverable. Diagrams must be explained clearly during the presentation. Explanatory text on the slides is optional unless needed. |
| Final presentation | **20 minutes per group: 15 for presentation and live demo, 5 for Q&A.** Recorded on Zoom (link on MCV) so instructors can review it later. Arrive **at least 15–20 minutes early**, and be ready to start early if the previous group finishes ahead of schedule. |

## How the project grows with the course _(derived)_

The project documents (proposal, ADRs, architecture diagrams) are revised as topics are taught.
They are not written all at once. This table maps each lecture topic to what the next revision
can add.

| After week | Topic taught | What the project can add |
| --- | --- | --- |
| 3 | Microservices, decomposition, system operations | Service decomposition, system operations |
| 5 | ADR, DDD, database per service | Proposal, ADRs, domain model, a database choice for each service |
| 6 | REST | REST service(s) |
| 7 | gRPC | gRPC service(s) |
| 10 | Async IPC, service discovery, broker vs brokerless, message broker | Message-broker service(s), a description of service discovery |
| 11 | API composition, external API, API gateway | API gateway, composition patterns |
| 12 | AI for software architecture | GenAI-assisted ADRs, architecture reconstruction |
| 13 | Architecture of AI-enabled systems | Optional. The minimum requirements do not include an AI component. |
| 14 | Queries, deployment, microservice testing | Query patterns, deployment view, load tests (at least 2 types) |

## Textbooks

Required:

- Ian Gorton, *Essential Software Architecture*, Springer, 2006
- Chris Richardson, *Microservices Patterns with examples in Java*, Manning, 2018

Further reading:

- Len Bass, Paul Clements, Rick Kazman, *Software Architecture in Practice*, 3rd ed., Addison-Wesley, 2013
- Moises Macero, *Learn Microservices with Spring Boot – A Practical Approach to RESTful Services using RabbitMQ, Eureka, Ribbon, Zuul and Cucumber*, Apress, 2017
- Christian Posta, *Microservices for Java Developers – A Hands-On Introduction to Frameworks & Containers*, O'Reilly, 2016
- Stephen R. Schach, *Classical and Object-Oriented Software Engineering with UML and Java*, McGraw-Hill, 1999

## Ambiguities in the source

- The two requirement lists differ on the number of load-test types, the risk-matrix count, and the
  example quality attributes. The merged checklist above resolves each difference toward the
  stricter reading.
- Quiz 1 (week 4) covers "Lecture from week 2", but week 2 was a holiday. Transcribed as written.
- Tutorials are numbered out of order: week 13 has Tutorial 7 and week 14 has Tutorial 6.
  Transcribed as written.
- "at lease" appears in the source and means "at least".
- The syllabus does not state a team size for the term project.
