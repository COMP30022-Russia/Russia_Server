import { expect, request } from 'chai';
import app from '../../';
import { createAP, createCarer } from '../helpers/user';

describe('Edit user details', () => {
    const agent = request.agent(app);

    // Tokens
    const CARER_USERNAME = 'update_carer';
    let carerToken: string;
    let apToken: string;

    before(async () => {
        // Create users
        carerToken = (await createCarer(CARER_USERNAME)).token;
        apToken = (await createAP('update_ap')).token;
    });

    it('Edit password', async () => {
        // Edit password
        const res = await agent
            .patch('/me/profile')
            .send({ password: 'new' })
            .set('Authorization', `Bearer ${carerToken}`);
        expect(res).to.be.json;
        expect(res).to.have.status(200);
        expect(res.body).to.have.property('id');

        // Try to log in with new password
        const logInRes = await agent
            .post('/users/login')
            .send({ username: CARER_USERNAME, password: 'new' });
        expect(logInRes).to.be.json;
        expect(logInRes).to.have.status(200);
        expect(logInRes.body).to.have.property('id');
    });

    it('Attempt to edit type', async () => {
        const res = await agent
            .patch('/me/profile')
            .send({ type: 'AP' })
            .set('Authorization', `Bearer ${carerToken}`);
        expect(res).to.be.json;
        expect(res).to.have.status(200);
        expect(res.body).to.have.property('id');
        expect(res.body).to.have.property('type');
        expect(res.body.type).to.equal('Carer');
    });

    it('Attempt to edit username', async () => {
        const res = await agent
            .patch('/me/profile')
            .send({ username: 'cool' })
            .set('Authorization', `Bearer ${carerToken}`);
        expect(res).to.be.json;
        expect(res).to.have.status(200);
        expect(res.body).to.have.property('id');
        expect(res.body).to.have.property('username');
        expect(res.body.username).to.equal(CARER_USERNAME);
    });

    it('Try to blank AP emergencyContactName', async () => {
        const res = await agent
            .patch('/me/profile')
            .send({ emergencyContactName: '' })
            .set('Authorization', `Bearer ${apToken}`);
        expect(res).to.be.json;
        expect(res).to.have.status(422);
        expect(res.body).to.have.property('message');
        expect(res.body.message).to.equal('Required fields cannot be deleted');
    });

    it('Update all AP fields (except password)', async () => {
        const modifications: any = {
            name: 'foo',
            mobileNumber: '20',
            DOB: '2018-12-10',
            emergencyContactName: 'fizz',
            emergencyContactNumber: '25'
        };

        // Check updated attributes
        const res = await agent
            .patch('/me/profile')
            .send(modifications)
            .set('Authorization', `Bearer ${apToken}`);
        expect(res).to.be.json;
        expect(res).to.have.status(200);
        expect(res.body).to.have.property('id');
        expect(res.body).to.have.property('type');
        expect(res.body).to.have.property('username');
        expect(res.body).to.not.have.property('password');
        for (const key of Object.keys(modifications)) {
            expect(res.body).to.have.property(key);
            expect(res.body[key]).to.equal(modifications[key]);
        }
    });
});
