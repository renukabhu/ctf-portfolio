from flask import Flask, request, render_template, redirect, url_for, session
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text

app = Flask(__name__)

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False 
app.config['SECRET_KEY'] = 'among-us'

db = SQLAlchemy(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True) 
    username = db.Column(db.String(100), unique=True, nullable=False) 
    password = db.Column(db.String(100), nullable=False)
    flags_ordered = db.Column(db.JSON, nullable=False)

    def __repr__(self):
        return f'<User {self.username}>'
    

def database_init():
    with app.app_context():
        db.create_all()
        
        alpha = User(username='alpha', password='skibidi', flags_ordered=["brainrot flag"])
        db.session.add(alpha)
        cyber = User(username='Cyber', password='xxxxxxxx', flags_ordered=["xxxxxxx"])
        db.session.add(cyber)
        sava = User(username='Savannah', password='cats123', flags_ordered=["Pride Flag", "Among Us Flag"])
        db.session.add(sava)
        r2uwu2 = User(username='Ronak', password='uwuowo', flags_ordered=[])
        db.session.add(r2uwu2)
        renuka = User(username='Renuka', password='Fortnite4Life', flags_ordered=["Fornite Flag"])
        db.session.add(renuka)
        bliutech = User(username='bliutech', password='Seaside_Lover', flags_ordered=["Chaewon American Flag"])
        db.session.add(bliutech)

        db.session.commit()
    
@app.route('/', methods=['GET', 'POST'])
def home():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        if "'" in username:
            return "Invalid username: single quote characters are not allowed.", 400



        # Totally secure code right here!
        query = text(f"SELECT * FROM user WHERE username = '{username}' AND password = '{password}'")
        user = db.session.execute(query).fetchone()

        if user:
            session['user_id'] = user.id
            return redirect(url_for('orders'))
        else:
            return "Sorry! This username and password combination is not a registered account :/", 401

    return render_template('index.html')

@app.route('/orders')
def orders():
    user_id = session.get('user_id')
    if not user_id:
        return redirect(url_for('login'))

    user = db.session.get(User, user_id)
    if not user:
        return redirect(url_for('login'))

    return render_template('orders.html', username=user.username, flags=user.flags_ordered)

database_init()
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3040)
