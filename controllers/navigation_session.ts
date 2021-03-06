import { Request, Response, NextFunction } from 'express';
import models from '../models';
import {
    sendNavigationControlSwitchedMessage,
    sendNavigationLocationMessage,
    sendRouteUpdateMessage,
    sendOffTrackMessage
} from './notification/navigation';
import retrieveRoute from '../helpers/maps';

// Cache for location
import NodeCache from 'node-cache';
import cacheService from '../helpers/cache';
const locationCache = cacheService(new NodeCache());
export { locationCache };

// Redeclare functions for tests
const sendLocationMessage = sendNavigationLocationMessage;
const sendRouteMessage = sendRouteUpdateMessage;
const getMapRoute = retrieveRoute;

// Switch control during navigation session
export const switchNavigationControl = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    // Extract session
    const session = req.session;

    try {
        // Flip control, increment sync and save
        session.carerHasControl = !session.carerHasControl;
        session.sync = session.sync + 1;
        await session.save();

        // Send notification
        await sendNavigationControlSwitchedMessage(
            session.APId === req.userID ? session.carerId : session.APId,
            session.id,
            session.carerHasControl,
            session.sync
        );

        return res.json(session.toJSON());
    } catch (err) {
        next(err);
    }
};

// Update AP's location during navigation sessions
export const updateAPLocation = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    // Extract IDs and lat/lon
    const sessionID = Number(req.params.sessionID);
    const userID = req.userID;
    const { lat, lon } = req.body;
    if (!lat || !lon) {
        res.status(422);
        return next(new Error('lat/lon missing'));
    }

    // First, check cache to see if location of current user is already stored
    // If location is stored, extract ID of target and increment sync
    const currentLocation: any = locationCache.getItem(String(userID));
    let targetID = currentLocation ? currentLocation.targetID : undefined;
    let sync = currentLocation ? currentLocation.sync + 1 : undefined;

    // If location is not stored, query for user's active session
    if (!currentLocation) {
        // Get session information
        const session = await models.Session.findOne({
            where: { id: sessionID, active: true },
            attributes: ['carerId', 'APId']
        });

        // Ensure that session is active/valid
        if (!session) {
            res.status(400);
            return next(new Error('Session is inactive or invalid'));
        }

        // Ensure that user is AP
        if (session.APId !== req.userID) {
            res.status(400);
            return next(
                new Error('Non-AP users are not allowed to set location')
            );
        }

        // Set userID of carer (opposite party) and initiate sync
        targetID = session.carerId;
        sync = 1;
    }

    // Cache user IDs and location
    locationCache.setItem(String(req.userID), { targetID, lat, lon, sync });

    // Send Firebase notification to target
    await sendLocationMessage(targetID, sessionID, lat, lon, sync);

    // Return success
    return res.json({ status: 'success' });
};

// Get AP location
export const getAPLocation = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    // Extract session
    const session = req.session;
    // Extract location of AP
    const location: any = locationCache.getItem(String(session.APId));

    // Location has not been set
    if (!location) {
        res.status(400);
        return next(new Error('AP location has not been set'));
    }

    // Return the location
    return res.json({ lon: location.lon, lat: location.lat });
};

// Returns the route
export const getRoute = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.session.route) {
            return res.json({});
        }
        return res.json(req.session.route);
    } catch (err) {
        next(err);
    }
};

// Set destination and generate ruote
export const setDestination = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    // Extract session, mode, placeID and name
    const session = req.session;
    const mode =
        !req.body.mode || req.body.mode === 'Walking' ? 'Walking' : 'PT';
    const placeID: string = req.body.placeID;
    const name = req.body.name;

    // Perform brief validation of placeID and name
    if (!placeID || !name) {
        res.status(400);
        return next(new Error('Incorrect input parameters'));
    }

    // Extract location of AP
    const location: any = locationCache.getItem(String(session.APId));
    if (!location) {
        res.status(400);
        return next(new Error('AP location has not been set'));
    }

    // Determine route
    let route;
    try {
        route = await getMapRoute(
            mode === 'Walking' ? true : false,
            placeID,
            location.lat,
            location.lon
        );
    } catch (err) {
        res.status(400);
        return next(err);
    }

    try {
        // Set route of navigation session
        await session.update({
            route,
            transportMode: mode,
            state: 'Started',
            sync: session.sync + 1
        });

        // Get destination
        let destination = await session.getDestination();
        if (destination) {
            // If destination for session already exists, update it
            await destination.update({ name, placeID });
        } else {
            // If not, create and set
            destination = await models.Destination.create({
                placeID,
                name,
                userId: session.APId
            });
            await session.setDestination(destination);
        }
    } catch (err) {
        next(err);
    }

    // Send notification
    await sendRouteMessage(
        session.APId,
        session.carerId,
        session.id,
        session.sync
    );

    return res.json({ status: 'success' });
};

// Send off track notification to carer
export const sendOffTrackNotification = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    // Extract session
    const session = req.session;

    try {
        // Ensure that only APs are sending notifications
        if (req.userID !== session.APId) {
            res.status(400);
            return next(
                new Error(
                    'Non AP users are not allowed to send' +
                        ' off-track notifications'
                )
            );
        }

        // Increment sync
        await session.update({ sync: session.sync + 1 });

        // Send notification
        const user = await models.User.scope('name').findByPk(session.APId);
        await sendOffTrackMessage(
            session.carerId,
            session.id,
            user.name,
            session.sync
        );
        return res.json({ status: 'success' });
    } catch (err) {
        next(err);
    }
};
