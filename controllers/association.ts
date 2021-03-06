import { Request, Response, NextFunction } from 'express';
import { jwtSign, jwtVerify } from '../helpers/jwt';
import { Op } from 'sequelize';
import models from '../models';
import { sendAssociationMessage } from './notification/association';

// Get association token of authenticated user
export const getAssociationToken = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // Sign token
        const payload = {
            type: 'Association',
            userID: req.userID
        };
        const token = await jwtSign(payload, '1h');

        // Return signed token
        return res.json({ token });
    } catch (err) {
        next(new Error('Association token could not be generated'));
    }
};

/**
 * Decodes a signed association token and returns the ID of the target user.
 * @param token Signed association token.
 * @return Promise for decoded ID of target user.
 */
const decodeAssociationToken = async (token: string): Promise<number> => {
    // Decode token
    let decodedRequest;
    try {
        decodedRequest = await jwtVerify(token);
    } catch (err) {
        throw new Error('Token is invalid or expired');
    }

    // Ensure that token is an association token and return user ID in token
    if (decodedRequest.type === 'Association') {
        return decodedRequest.userID;
    } else {
        throw new Error('Token is invalid');
    }
};

// Creates an association between an AP and a carer
export const createAssociation = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const initiatorID: number = req.userID;
    let targetID: number;

    // Decode token to find user ID of target
    try {
        targetID = await decodeAssociationToken(req.body.token);
    } catch (err) {
        res.status(401);
        return next(err);
    }

    try {
        // Get types of initiator and target users
        const initiator = await models.User.scope('type').findByPk(initiatorID);
        const target = await models.User.scope('type').findByPk(targetID);

        // Ensure that accounts of the same type are not associated
        if (initiator.type === target.type) {
            throw new Error('Accounts of the same type cannot be associated');
        }

        // Assign IDs depending on account type of initiator/target
        const apId = initiator.type === 'AP' ? initiatorID : targetID;
        const carerId = initiator.type === 'Carer' ? initiatorID : targetID;

        // If an existing association exists
        const existing = await models.Association.findOne({
            where: { carerId, APId: apId }
        });
        if (existing) {
            if (existing.active) {
                // If association exists and is already active
                throw new Error('An association already exists');
            } else {
                // If association is inactive, make association active
                await existing.update({ active: true });
                return res.json({ status: 'success' });
            }
        }

        // Create association
        const created = await models.Association.create({
            carerId,
            APId: apId
        });

        // Send data message to notify target
        await sendAssociationMessage(targetID);

        return res.json(created.toJSON());
    } catch (err) {
        res.status(400);
        return next(err);
    }
};

/**
 * Finds the current type of the user and returns the opposite type.
 * @param id ID of user.
 * @return Promise for the opposite type as a string.
 */
const findOppositeUserType = async (id: number): Promise<string> => {
    const type = (await models.User.scope('type').findByPk(id)).type;
    return type === 'AP' ? 'Carer' : 'AP';
};

// List associations of the authenticated user
export const getAssociations = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const userID = req.userID;

    try {
        // Find type of user and the opposite type
        const oppositeType = await findOppositeUserType(req.userID);

        // Find associations and populate associated users of the other type
        const associations = await models.Association.findAll({
            where: {
                active: true,
                [Op.or]: [{ APId: userID }, { carerId: userID }]
            },
            include: {
                model: models.User,
                as: oppositeType
            }
        });
        // If there are no associations, return an empty array
        if (!associations) {
            return res.json([]);
        }

        // Map to JSON and return
        const associationsJSON = associations.map((association: any) => {
            // Rename 'AP'/'Carer' key to 'user'
            const { [oppositeType]: user, ...other } = association.toJSON();
            return { ...other, user };
        });
        return res.json(associationsJSON);
    } catch (err) {
        next(err);
    }
};

// Get details about the specified association
export const getAssociation = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const userID = req.userID;

    try {
        // Find type of user and the opposite type
        const oppositeType = await findOppositeUserType(userID);

        // Find the requested association, where the authenticated user is a
        // carer/AP for the association and populate the other user
        const association = await models.Association.findOne({
            where: {
                id: req.params.associationID,
                active: true,
                [Op.or]: [{ APId: userID }, { carerId: userID }]
            },
            include: {
                model: models.User,
                as: oppositeType
            }
        });
        if (!association) {
            res.status(400);
            throw new Error(
                'Association is inactive, non-existant or user is not a' +
                    ' member of the requested association'
            );
        }

        // Rename 'AP'/'Carer' key to 'user'
        const { [oppositeType]: user, ...other } = association.toJSON();
        return res.json({ ...other, user });
    } catch (err) {
        return next(err);
    }
};
