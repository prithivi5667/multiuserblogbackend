const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.contactForm = (req, res) => {
  const { email, name, message } = req.body;
  const emailData = {
    to: 'luiscusihuaman88@gmail.com',
    from: email,
    subject: `Contact form - ${process.env.APP_NAME}`,
    text: `
            Email received from contact from
            Sender name: ${name}
            Sender email: ${email}
            Sender message: ${message}
          `,
    html: `
            <h4>Email received from contact form:</h4>
            <p>Sender name: ${name}</p>
            <p>Sender email: ${email}</p>
            <p>Sender message: ${message}</p>
            <hr/>
            <p>This email may contain sensetive information</p>
            <p>https://seoblog.luistest.xyz</p>
          `,
  };
  sgMail
    .send(emailData)
    .then((data) => res.json({ data, success: true }))
    .catch((err) => console.log(err));
};

exports.contactBlogAuthorForm = (req, res) => {
  const { authorEmail, email, name, message } = req.body;
  console.log(authorEmail);
  const emailData = {
    to: authorEmail || 'lcusihuaman@fi.uba.ar',
    from: email,
    subject: `Someone message you from - ${process.env.APP_NAME}`,
    text: `
            Email received from contact from
            Sender name: ${name}
            Sender email: ${email}
            Sender message: ${message}
          `,
    html: `
            <h4>Message recived from:</h4>
            <p>Name: ${name}</p>
            <p>Email: ${email}</p>
            <p>Message: ${message}</p>
            <hr/>
            <p>This email may contain sensetive information</p>
            <p>https://seoblog.luistest.xyz</p>
          `,
  };
  sgMail
    .send(emailData)
    .then((data) => res.json({ data, success: true }))
    .catch((err) => console.log(err));
};
