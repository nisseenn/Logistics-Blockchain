//Denne filen er en script fil for prosessering av funksjonene vi definerte i modellfilen.
//Filen består hovedsaklig av funksjoner som utføres når transaksjoner blir gjennomført ved bruk av front-end.

//En transaksjonsfunksjon starter med en mennesklig-leselig definisjon av hva transaksjonsprosessoren gjør.
//Den andre linjen inkluderer @param for å indikere parameterdefinisjonen.
//Deretter kommer ressursnavnet til transaksjonen, som trigger funksjonen, denne tar i mot namespacet og deretter transaksjonsnavnet.
//Etter ressursnavnet kommer parameternavnet som refererer til ressursen, denne parameteren må gis til funksjonen som argument.
//Den tredje linjen må inneholde @transaction, da den identifiserer koden som en transaksjon.
//Etter kommentarene kommer selve funksjonen. Den kan ha  et navn, men må inkludere parameter som vi definerte i kommentaren.

'use strict';

/* global getFactory getAssetRegistry getParticipantRegistry emit */

/**
 * Lag blankett
 * @param {org.example.ava.InitialApplication} initalAppliation - InitialApplication transaksjon
 * @transaction
 */
async function initialApplication(application) { // eslint-disable-line no-unused-vars
    //getFactory brukes for å lage nye instanser med eiendeler, aktører og transaksjoner for å lagre disse i registre. De kan også brukes for å lage relasjoner til eiendeler, aktører og transaksjoner.
    const factory = getFactory();
    const namespace = 'org.example.ava';

    //newResource henger sammen med getFactory for å lagre ressurser i registre.
    //newRelationship lager en relasjon med en gitt namespace, type og identifikator
    //getIdentifier henter identifieren av instansen den står foran.
    //Lager de nødvendige ressursene som er nødvendige for en blankett.
    const letter = factory.newResource(namespace, 'Blankett', application.blankettId);

    letter.sender = factory.newRelationship(namespace, 'EndePerson', application.sender.getIdentifier());

    letter.mottaker = factory.newRelationship(namespace, 'EndePerson', application.mottaker.getIdentifier());

    letter.fas = factory.newRelationship(namespace, 'Administrasjon', application.sender.administrasjon.getIdentifier());

    letter.nlk = factory.newRelationship(namespace, 'Administrasjon', application.mottaker.administrasjon.getIdentifier());

    //Setter reglene i blanketten til å være lik argumentets verdier til variablen "rules"
    letter.rules = application.rules;

    letter.productDetails = application.productDetails;
    letter.evidence = [];

    letter.approval = [factory.newRelationship(namespace, 'EndePerson', application.sender.getIdentifier())];
    letter.status = 'AWAITING_APPROVAL';

    //Lagrer applikasjonen
    //getAssetRegistry brukes for å håndtere et sett med eiendeler på blockchainen
    //getFullyQualifiedType returnerer en navn på en ressurs
    const assetRegistry = await getAssetRegistry(letter.getFullyQualifiedType());
    await assetRegistry.add(letter);

    //emit hendelsen
    //newEvent lager en ny hendelse
    const applicationEvent = factory.newEvent(namespace, 'InitialApplicationEvent');
    applicationEvent.blankett = letter;
    emit(applicationEvent);
}

/**
 * Lag transportplan
 * @param {org.example.ava.tplanApplication} tplanApplication - tplanApplication transaksjon
 * @transaction
 */
async function tplanApplication(application) { // eslint-disable-line no-unused-vars
    const factory = getFactory();
    const namespace = 'org.example.ava';

    const letter = factory.newResource(namespace, 'Tplan', application.planId);

    letter.fas = factory.newRelationship(namespace, 'Administrasjon', application.fas.getIdentifier());

    letter.sjofor = factory.newRelationship(namespace, 'EndePerson', application.sjofor.getIdentifier());

    letter.rules = application.rules;

    letter.sendDetails = application.sendDetails;
    letter.evidence = [];

    //save the application
    const assetRegistry = await getAssetRegistry(letter.getFullyQualifiedType());
    await assetRegistry.add(letter);

    //emit hendelsen
    const applicationEvent = factory.newEvent(namespace, 'tplanApplicationEvent');
    applicationEvent.tplan = letter;
    emit(applicationEvent);
}


/**
 * Oppdater Blankett for å vise at den har blitt godkjent av en aktør
 * @param {org.example.ava.Approve} approve - Approve transaction
 * @transaction
 */
async function approve(approveRequest) { // eslint-disable-line no-unused-vars
    const factory = getFactory();
    const namespace = 'org.example.ava';

    //Henter blanketten
    let letter = approveRequest.blankett;

    //Sjekker hva statusen i blanketten er satt til
    if (letter.status === 'CLOSED' || letter.status === 'REJECTED') {
        throw new Error ('Denne blanketten har blitt avsluttet');

    //Sjekker hvor mange som har godkjent blanketten
    } else if (letter.approval.length === 4) {
        throw new Error ('Alle noder har allerede godkjent denne sendingen');

    //Dersom personen allerede har godkjent blanketten
    } else if (letter.approval.includes(approveRequest.approvingParty)) {
        throw new Error ('Denne personen har allerede godkjent denne blanketten');

    //Sjekker om aktør med type AdmEmployee allerede har godkjent
    } else if (approveRequest.approvingParty.getType() === 'AdmEmployee') {
        letter.approval.forEach((approvingParty) => {
            let admApproved = false;
            try {
                admApproved = approvingParty.getType() === 'AdmEmployee' && approvingParty.administrasjon.getIdentifier() === approveRequest.approvingParty.administrasjon.getIdentifier();
            } catch (err) {

            }
            if (admApproved) {
                throw new Error('Adm har allerede godkjent blankett');
            }
        });
    }

    letter.approval.push(factory.newRelationship(namespace, approveRequest.approvingParty.getType(), approveRequest.approvingParty.getIdentifier()));
    // Oppdater statusen til blanketten hvis alle har godkjent
    if (letter.approval.length === 4) {
        letter.status = 'APPROVED';
    }

    // oppdater approval[]
    const assetRegistry = await getAssetRegistry(approveRequest.blankett.getFullyQualifiedType());
    await assetRegistry.update(letter);

    //emit hendelse
    const approveEvent = factory.newEvent(namespace, 'ApproveEvent');
    approveEvent.blankett = approveRequest.blankett;
    approveEvent.approvingParty = approveRequest.approvingParty;
    emit(approveEvent);
}


/**
 * Avvis blanketten
 * @param {org.example.ava.Reject} reject - Reject transaksjon
 * @transaction
 */
async function reject(rejectRequest) { // eslint-disable-line no-unused-vars
    const factory = getFactory();
    const namespace = 'org.example.ava';

    let letter = rejectRequest.blankett;

    if (letter.status === 'CLOSED' || letter.status === 'REJECTED') {
        throw new Error('Denne blanketten har allerede blitt avsluttet');
    } else if (letter.status === 'APPROVED') {
        throw new Error('Denne blanketten har allerede blitt godkjent');
    } else {
        letter.status = 'REJECTED';
        //henter closereason fra blanketten
        letter.closeReason = rejectRequest.closeReason;

        // Oppdater statusen til blanketten
        const assetRegistry = await getAssetRegistry(rejectRequest.blankett.getFullyQualifiedType());
        await assetRegistry.update(letter);

        //emit hendelse
        const rejectEvent = factory.newEvent(namespace, 'RejectEvent');
        rejectEvent.blankett = rejectRequest.blankett;
        rejectEvent.closeReason = rejectRequest.closeReason;
        emit(rejectEvent);
    }
}

/**
     * Foreslå endringer til blanketten
     * @param {org.example.ava.SuggestChanges} suggestChanges - SuggestChanges transaksjon
     * @transaction
     */
async function suggestChanges(changeRequest) { // eslint-disable-line no-unused-vars
    const factory = getFactory();
    const namespace = 'org.example.ava';

    let letter = changeRequest.blankett;

    //Dersom ingen av if/else if har skjedd: sett regler til nye regler og sett status. I tillegg blir den som legger til endringer satt automatisk til å godkjenne blanketten.
    if (letter.status === 'CLOSED' || letter.status === 'REJECTED') {
        throw new Error ('Denne blanketten har blitt avsluttet');
    } else if (letter.status === 'APPROVED') {
        throw new Error('Denne blanketten har blitt godkjent');
    } else if (letter.status === 'SHIPPED' || letter.status === 'RECEIVED') {
        throw new Error ('Materiellet har blitt sendt');
    } else {
        letter.rules = changeRequest.rules;
        // Endringer i betingelser har skjedd, reset approval array og oppdater status
        letter.approval = [changeRequest.suggestingParty];
        letter.status = 'AWAITING_APPROVAL';

        // Oppdater blanketten med nye regler
        const assetRegistry = await getAssetRegistry(changeRequest.blankett.getFullyQualifiedType());
        await assetRegistry.update(letter);

        // emit hendelse
        const changeEvent = factory.newEvent(namespace, 'SuggestChangesEvent');
        changeEvent.blankett = changeRequest.blankett;
        changeEvent.rules = changeRequest.rules;
        changeEvent.suggestingParty = changeRequest.suggestingParty;
        emit(changeEvent);
    }
}

/**
* Send materiellet
* @param {org.example.ava.ShipProduct} shipProduct - ShipProduct transaksjon
* @transaction
*/
async function shipProduct(shipRequest) { // eslint-disable-line no-unused-vars
    const factory = getFactory();
    const namespace = 'org.example.ava';

    let letter = shipRequest.blankett;

    //Sett status til shipped hvis den er godkjent
    //evidence blir pushet til blanketten. Denne er derimot i dette nettverket ikke-eksisterende
    if (letter.status === 'APPROVED') {
        letter.status = 'SHIPPED';
        letter.evidence.push(shipRequest.evidence);

        //Oppdater statusen til blanketten
        const assetRegistry = await getAssetRegistry(shipRequest.blankett.getFullyQualifiedType());
        await assetRegistry.update(letter);

        // emit hendelse
        const shipEvent = factory.newEvent(namespace, 'ShipProductEvent');
        shipEvent.blankett = shipRequest.blankett;
        emit(shipEvent);

    //Dersom statusen på blanketten ikke er "APPROVED" sjekker vi de andre tilstandene.
    } else if (letter.status === 'AWAITING_APPROVAL') {
        throw new Error ('Blanketten må bli godkjent før sending');
    } else if (letter.status === 'CLOSED' || letter.status ===    'REJECTED') {
        throw new Error ('Denne blanketten har blitt avsluttet');
    } else {
        throw new Error ('Materiellet har blitt sendt');
    }
}

/**
  * Motta materiellet som har blitt sendt
  * @param {org.example.ava.ReceiveProduct} receiveProduct - ReceiveProduct transaction
  * @transaction
  */
async function receiveProduct(receiveRequest) { // eslint-disable-line no-unused-vars
    const factory = getFactory();
    const namespace = 'org.example.ava';

    let letter = receiveRequest.blankett;

    //Setter statusen til blanketten til "RECIEVED" dersom status er "SHIPPED".
    if (letter.status === 'SHIPPED') {
        letter.status = 'RECEIVED';

        // Oppdater statusen til blanketten
        const assetRegistry = await getAssetRegistry(receiveRequest.blankett.getFullyQualifiedType());
        await assetRegistry.update(letter);

        // emit hendelse
        const receiveEvent = factory.newEvent(namespace, 'ReceiveProductEvent');
        receiveEvent.blankett = receiveRequest.blankett;
        emit(receiveEvent);

    //Dersom statusen ikke er "SHIPPED" sjekker vi for de andre tilstandene
    } else if (letter.status === 'AWAITING_APPROVAL' || letter.status === 'APPROVED'){
        throw new Error('Materiellet må bli sendt før det kan mottas');
    } else if (letter.status === 'CLOSED' || letter.status === 'REJECTED') {
        throw new Error ('Denne blanketten har blitt avsluttet');
    } else {
        throw new Error('Materiellet har allerede blitt mottat');
    }
}

/**
* Avslutt blanketten
* @param {org.example.ava.Close} close - Close transaction
* @transaction
*/
async function close(closeRequest) { // eslint-disable-line no-unused-vars
    const factory = getFactory();
    const namespace = 'org.example.ava';

    let letter = closeRequest.blankett;

    //Sjekker om statusen til blanketten er "RECIEVED". Setter dem til "CLOSED" dersom dette er sant.
    if (letter.status === 'RECEIVED') {
        letter.status = 'CLOSED';
        letter.closeReason = closeRequest.closeReason;

        // Oppdater statusen til blanketten
        const assetRegistry = await getAssetRegistry(closeRequest.blankett.getFullyQualifiedType());
        await assetRegistry.update(letter);

        // emit hendelsen
        const closeEvent = factory.newEvent(namespace, 'CloseEvent');
        closeEvent.blankett = closeRequest.blankett;
        closeEvent.closeReason = closeRequest.closeReason;
        emit(closeEvent);

    //Dersom statusen til blanketten ikke er "RECIEVED" sjekker vi de andre tilstandene.
    } else if (letter.status === 'CLOSED' || letter.status === 'REJECTED') {
        throw new Error('Denne blanketten har allerede blitt avsluttet');
    } else {
        throw new Error('Kan ikke avslutte denne blanketten før den er godkjent og materiellet et motatt');
    }
}

/**
* Lag demobrukere for nettverket
* @param {org.example.ava.CreateDemoParticipants} createDemoParticipants - CreateDemoParticipants transaction
* @transaction
*/
async function createDemoParticipants() { // eslint-disable-line no-unused-vars
    const factory = getFactory();
    const namespace = 'org.example.ava';

    // Lag de administrerende aktørene
    // getParticipantRegistry henter fra registret. I dette tilfellet henter vi Administrasjon fra participantregistret.
    const administrasjonRegistry = await getParticipantRegistry(namespace + '.Administrasjon');
    const adm1 = factory.newResource(namespace, 'Administrasjon', 'FAS');
    adm1.name = 'Forsvarets Alarm Sentral';
    await administrasjonRegistry.add(adm1);
    const adm2 = factory.newResource(namespace, 'Administrasjon', 'NLK');
    adm2.name = 'NLK';
    await administrasjonRegistry.add(adm2);

    // Lager ansatte i de administrerende enhetene
    const employeeRegistry = await getParticipantRegistry(namespace + '.AdmEmployee');
    const employee1 = factory.newResource(namespace, 'AdmEmployee', 'matias');
    employee1.name = 'Matías';
    employee1.lastName = 'Ekeberg';
    employee1.administrasjon = factory.newRelationship(namespace, 'Administrasjon', 'FAS');
    await employeeRegistry.add(employee1);
    const employee2 = factory.newResource(namespace, 'AdmEmployee', 'ella');
    employee2.name = 'Ella';
    employee2.lastName = 'Bella';
    employee2.administrasjon = factory.newRelationship(namespace, 'Administrasjon', 'NLK');
    await employeeRegistry.add(employee2);


    // lage endepersoner
    const endepersonRegistry = await getParticipantRegistry(namespace + '.EndePerson');
    const endeperson1 = factory.newResource(namespace, 'EndePerson', 'alice');
    endeperson1.name = 'Alice';
    endeperson1.lastName= 'Hamilton';
    endeperson1.administrasjon = factory.newRelationship(namespace, 'Administrasjon', 'FAS');
    endeperson1.avdeling = 'CISTG';
    await endepersonRegistry.add(endeperson1);
    const endeperson2 = factory.newResource(namespace, 'EndePerson', 'bob');
    endeperson2.name = 'Bob';
    endeperson2.lastName= 'Appleton';
    endeperson2.administrasjon = factory.newRelationship(namespace, 'Administrasjon', 'NLK');
    endeperson2.avdeling = 'HV14';
    await endepersonRegistry.add(endeperson2);
    const endeperson3 = factory.newResource(namespace, 'EndePerson', 'roar');
    endeperson3.name = 'Roar';
    endeperson3.lastName= 'Johnsen';
    endeperson3.administrasjon = factory.newRelationship(namespace, 'Administrasjon', 'FAS');
    endeperson3.avdeling = 'FLO';
    await endepersonRegistry.add(endeperson3);
}
