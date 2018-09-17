import Sequelize, { Op } from 'sequelize';

// Import defined schemas
import userModel from './user';
import associationModel from './association';
import messageModel from './message';
import sessionModel from './session';
import destinationModel from './destination';
import emergencyModel from './emergency';
import locationModel from './location';
import pictureModel from './picture';
import firebaseTokenModel from './firebase_token';

// Define database connection
const sequelize: Sequelize.Sequelize = new Sequelize(
    process.env.POSTGRES_DB,
    process.env.POSTGRES_USER,
    process.env.POSTGRES_PASSWORD,
    {
        host: process.env.DB_HOST,
        dialect: 'postgres',
        operatorsAliases: Op as any,
        logging: process.env.NODE_ENV === 'development' ? true : false
    }
);

const db: any = {};

// Import/associate models
const User = userModel.init(sequelize);
const Association = associationModel.init(sequelize);
const Message = messageModel.init(sequelize);
const Destination = destinationModel.init(sequelize);
const Session = sessionModel.init(sequelize);
const Emergency = emergencyModel.init(sequelize);
const Location = locationModel.init(sequelize);
const Picture = pictureModel.init(sequelize);
const FirebaseToken = firebaseTokenModel.init(sequelize);

db.User = User;
db.Association = Association;
db.Message = Message;
db.Destination = Destination;
db.Session = Session;
db.Emergency = Emergency;
db.Location = Location;
db.FirebaseToken = FirebaseToken;
db.Picture = Picture;

// User-user through Association table
User.belongsToMany(User, {
    through: Association,
    as: 'Carer',
    foreignKey: 'carerId'
});
User.belongsToMany(User, {
    through: Association,
    as: 'AP',
    foreignKey: 'APId'
});
Association.belongsTo(User, { as: 'AP', foreignKey: 'APId' });
Association.belongsTo(User, { as: 'Carer', foreignKey: 'carerId' });

// User is associated with multiple locations
User.hasMany(Location, { as: 'location', foreignKey: 'userId' });
User.belongsTo(Location, {
    as: 'CurrentLocation',
    foreignKey: 'currentLocationId',
    constraints: false
});

// User has many Firebase tokens
User.hasMany(FirebaseToken, { as: 'firebaseTokens' });

// Message is associated with an author (a user) and an association
Message.belongsTo(User, { as: 'author' });
Message.belongsTo(Association, { as: 'association' });

// Message can have picture
Message.hasMany(Picture, { foreignKey: 'messageId', as: 'pictures' });

// Session is associated with AP and Carer
Session.belongsTo(User, { as: 'Carer', foreignKey: 'carerId' });
Session.belongsTo(User, { as: 'AP', foreignKey: 'APId' });

// Session has destination
Session.belongsTo(Destination, { as: 'destination' });
Destination.belongsTo(User, { as: 'user' });

// Emergency has initator and handler
Emergency.belongsTo(User, { as: 'AP', foreignKey: 'APId' });
Emergency.belongsTo(User, { as: 'Carer', foreignKey: 'carerId' });

db.sequelize = sequelize;
db.Sequelize = sequelize;

export default db;
export { sequelize };
