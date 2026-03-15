/* Job data now lives in melbourneJobs.js */

export const USER_SKILLS = [
  { name: 'React / TS', level: 88, tag: 'strong' },
  { name: 'Figma / UI', level: 82, tag: 'strong' },
  { name: 'Python', level: 65, tag: 'ok' },
  { name: 'SQL', level: 48, tag: 'ok' },
  { name: 'AWS / Cloud', level: 18, tag: 'gap' },
  { name: 'Docker / CI', level: 12, tag: 'gap' },
]

export const SKILL_GAPS = [
  { name: 'AWS/GCP', freq: 8 },
  { name: 'Docker', freq: 6 },
  { name: 'GraphQL', freq: 4 },
  { name: 'CI/CD', freq: 4 },
]

export const LEARNING_COURSES = {
  'AWS': [
    { title: 'Ultimate AWS Certified Cloud Practitioner', platform: 'Udemy', instructor: 'Stephane Maarek', rating: 4.7, students: '900K+', duration: '15h', icon: '☁️', url: 'https://www.udemy.com/course/aws-certified-cloud-practitioner-new/' },
    { title: 'AWS Cloud Technical Essentials', platform: 'Coursera', instructor: 'AWS', rating: 4.6, students: '180K+', duration: '12h', icon: '☁️', url: 'https://www.coursera.org/learn/aws-cloud-technical-essentials' },
  ],
  'AWS/GCP': [
    { title: 'Ultimate AWS Certified Cloud Practitioner', platform: 'Udemy', instructor: 'Stephane Maarek', rating: 4.7, students: '900K+', duration: '15h', icon: '☁️', url: 'https://www.udemy.com/course/aws-certified-cloud-practitioner-new/' },
    { title: 'Google Cloud Fundamentals', platform: 'Coursera', instructor: 'Google Cloud', rating: 4.6, students: '500K+', duration: '14h', icon: '☁️', url: 'https://www.coursera.org/learn/gcp-fundamentals' },
  ],
  'GCP': [
    { title: 'Google Cloud Fundamentals', platform: 'Coursera', instructor: 'Google Cloud', rating: 4.6, students: '500K+', duration: '14h', icon: '☁️', url: 'https://www.coursera.org/learn/gcp-fundamentals' },
    { title: 'GCP Associate Cloud Engineer', platform: 'Udemy', instructor: 'Dan Sullivan', rating: 4.5, students: '120K+', duration: '20h', icon: '☁️', url: 'https://www.udemy.com/course/google-cloud-associate-cloud-engineer/' },
  ],
  'Docker': [
    { title: 'Docker & Kubernetes: The Practical Guide', platform: 'Udemy', instructor: 'Maximilian Schwarzmüller', rating: 4.7, students: '300K+', duration: '23h', icon: '🐳', url: 'https://www.udemy.com/course/docker-kubernetes-the-practical-guide/' },
    { title: 'Introduction to Containers w/ Docker', platform: 'Coursera', instructor: 'IBM', rating: 4.5, students: '200K+', duration: '10h', icon: '🐳', url: 'https://www.coursera.org/learn/ibm-containers-docker-kubernetes-openshift' },
  ],
  'GraphQL': [
    { title: 'Complete GraphQL with React', platform: 'Udemy', instructor: 'Stephen Grider', rating: 4.6, students: '80K+', duration: '13h', icon: '◈', url: 'https://www.udemy.com/course/graphql-with-react-course/' },
    { title: 'APIs with GraphQL', platform: 'Codecademy', instructor: 'Codecademy', rating: 4.4, students: '50K+', duration: '8h', icon: '◈', url: 'https://www.codecademy.com/learn/learn-graphql' },
  ],
  'CI/CD': [
    { title: 'DevOps: CI/CD with Jenkins & Docker', platform: 'Udemy', instructor: 'Edward Viaene', rating: 4.5, students: '150K+', duration: '11h', icon: '⚙️', url: 'https://www.udemy.com/course/learn-devops-ci-cd-with-jenkins-using-pipelines-and-docker/' },
    { title: 'Continuous Integration & Delivery', platform: 'Coursera', instructor: 'University of Minnesota', rating: 4.4, students: '60K+', duration: '16h', icon: '⚙️', url: 'https://www.coursera.org/learn/continuous-integration' },
  ],
  'Kubernetes': [
    { title: 'Kubernetes for Absolute Beginners', platform: 'Udemy', instructor: 'Mumshad Mannambeth', rating: 4.6, students: '250K+', duration: '10h', icon: '⎈', url: 'https://www.udemy.com/course/learn-kubernetes/' },
    { title: 'Getting Started with Google Kubernetes Engine', platform: 'Coursera', instructor: 'Google Cloud', rating: 4.5, students: '140K+', duration: '12h', icon: '⎈', url: 'https://www.coursera.org/learn/google-kubernetes-engine' },
  ],
  'Terraform': [
    { title: 'HashiCorp Certified: Terraform Associate', platform: 'Udemy', instructor: 'Zeal Vora', rating: 4.6, students: '100K+', duration: '18h', icon: '🏗️', url: 'https://www.udemy.com/course/terraform-beginner-to-advanced/' },
    { title: 'Infrastructure as Code with Terraform', platform: 'Coursera', instructor: 'Google Cloud', rating: 4.4, students: '45K+', duration: '8h', icon: '🏗️', url: 'https://www.coursera.org/learn/terraform-cloud' },
  ],
  'Kafka': [
    { title: 'Apache Kafka for Beginners', platform: 'Udemy', instructor: 'Stephane Maarek', rating: 4.7, students: '200K+', duration: '8h', icon: '📨', url: 'https://www.udemy.com/course/apache-kafka/' },
    { title: 'Event-Driven Architecture with Kafka', platform: 'Confluent', instructor: 'Confluent', rating: 4.5, students: '30K+', duration: '6h', icon: '📨', url: 'https://developer.confluent.io/courses/' },
  ],
  'Spark': [
    { title: 'Apache Spark with Python - Big Data', platform: 'Udemy', instructor: 'Frank Kane', rating: 4.5, students: '120K+', duration: '15h', icon: '⚡', url: 'https://www.udemy.com/course/taming-big-data-with-apache-spark-hands-on/' },
    { title: 'Big Data with PySpark', platform: 'Coursera', instructor: 'IBM', rating: 4.4, students: '80K+', duration: '12h', icon: '⚡', url: 'https://www.coursera.org/learn/big-data-with-pyspark' },
  ],
  'Spring Boot': [
    { title: 'Spring Boot 3 & Spring 6', platform: 'Udemy', instructor: 'Chad Darby', rating: 4.7, students: '350K+', duration: '52h', icon: '🌱', url: 'https://www.udemy.com/course/spring-hibernate-tutorial/' },
    { title: 'Building Scalable Java Microservices', platform: 'Coursera', instructor: 'Google Cloud', rating: 4.5, students: '90K+', duration: '10h', icon: '🌱', url: 'https://www.coursera.org/learn/google-cloud-java-spring' },
  ],
  '.NET': [
    { title: 'Complete C# & .NET Developer', platform: 'Udemy', instructor: 'Mosh Hamedani', rating: 4.6, students: '200K+', duration: '30h', icon: '🔷', url: 'https://www.udemy.com/course/the-complete-csharp-developer-course/' },
    { title: '.NET Full Stack Foundation', platform: 'Coursera', instructor: 'Board Infinity', rating: 4.4, students: '40K+', duration: '20h', icon: '🔷', url: 'https://www.coursera.org/learn/dotnet-fullstack' },
  ],
  'Rails': [
    { title: 'The Complete Ruby on Rails Developer', platform: 'Udemy', instructor: 'Rob Percival', rating: 4.5, students: '100K+', duration: '46h', icon: '💎', url: 'https://www.udemy.com/course/the-complete-ruby-on-rails-developer-course/' },
    { title: 'Ruby on Rails Web Development', platform: 'Coursera', instructor: 'Johns Hopkins', rating: 4.4, students: '70K+', duration: '16h', icon: '💎', url: 'https://www.coursera.org/learn/ruby-on-rails-intro' },
  ],
  'Azure': [
    { title: 'AZ-900: Azure Fundamentals', platform: 'Udemy', instructor: 'Scott Duffy', rating: 4.6, students: '400K+', duration: '10h', icon: '☁️', url: 'https://www.udemy.com/course/az900-azure/' },
    { title: 'Microsoft Azure Fundamentals', platform: 'Coursera', instructor: 'Microsoft', rating: 4.6, students: '250K+', duration: '14h', icon: '☁️', url: 'https://www.coursera.org/learn/microsoft-azure-fundamentals' },
  ],
  'Machine Learning': [
    { title: 'Machine Learning A-Z', platform: 'Udemy', instructor: 'Kirill Eremenko', rating: 4.5, students: '900K+', duration: '44h', icon: '🧠', url: 'https://www.udemy.com/course/machinelearning/' },
    { title: 'Machine Learning Specialization', platform: 'Coursera', instructor: 'Andrew Ng', rating: 4.9, students: '2M+', duration: '33h', icon: '🧠', url: 'https://www.coursera.org/specializations/machine-learning-introduction' },
  ],
}

export const PASSPORT_DATA = {
  name: 'Alex Chen',
  country: 'AUSTRALIA',
  from: 'MELB',
  to: 'HIRE',
  flight: 'LD-2026',
  gate: 'G7',
  class: 'Grad Eng',
  season: '2026',
  degree: 'Mech Eng / Biomed',
  university: 'Monash University',
  year: '3rd year',
  resumeUpdated: 'Updated Mar 10',
  searching: 'Internships 2026',
  locations: 'Melbourne, Remote',
  fields: 'Design, Engineering',
  swipedToday: 12,
  tailorsLeft: 3,
  stamps: [
    { icon: '✈', label: 'REA Group Applied', type: 'filled' },
    { icon: '🤖', label: 'AI Tailor ×2', type: 'filled' },
    { icon: '✦', label: 'Coach session', type: 'gold' },
    { icon: '✦', label: '', type: 'empty' },
    { icon: '✦', label: '', type: 'empty' },
    { icon: '✦', label: '', type: 'empty' },
  ],
}
