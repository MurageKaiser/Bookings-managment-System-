/* =========================================================
   ONGOING JOBS GATE
   ---------------------------------------------------------
   Enforces that Ongoing jobs are addressed before the
   planner can act on New Bookings, during a configured
   daily time window.
========================================================= */


/* =========================================================
   IS CURRENT TIME WITHIN THE GATE WINDOW
========================================================= */

function isWithinGateWindow(gateConfig) {

    const formatter = new Intl.DateTimeFormat("en-GB", {
        timeZone: gateConfig.timezone,
        hour: "2-digit",
        hour12: false
    });

    const currentHour = parseInt(formatter.format(new Date()), 10);

    const startHour = gateConfig.startHour;
    const endHour = gateConfig.endHour;

    if (startHour > endHour) {
        /* Window wraps past midnight, e.g. 16 -> 8 */
        return currentHour >= startHour || currentHour < endHour;
    }

    return currentHour >= startHour && currentHour < endHour;
}


/* =========================================================
   DOES ANY ONGOING JOB EXIST
========================================================= */

function hasOngoingJobs(gateConfig) {

    return getReportRecords(
        gateConfig.reportName,
        gateConfig.criteria,
        1
    )
        .then(function(records) {
            return records.length > 0;
        });

}


/* =========================================================
   SHOULD NEW BOOKINGS BE GATED RIGHT NOW
========================================================= */

function shouldGateNewBookings() {

    const gateConfig = CONFIG.ongoingJobsGate;

    if (!gateConfig || gateConfig.enabled === false) {
        return Promise.resolve(false);
    }

    return isCurrentUserAdmin(gateConfig)
        .then(function(isAdmin) {
            if (isAdmin) {
                return false; // admins are never gated
            }

            if (!isWithinGateWindow(gateConfig)) {
                return false;
            }

            return hasOngoingJobs(gateConfig)
                .catch(function(error) {
                    console.error("Failed to check ongoing jobs for gate:", error);
                    return false; // fail open on the ongoing-jobs check itself
                });
        });

}
/* =========================================================
   IS CURRENT USER AN ADMIN
========================================================= */

function isCurrentUserAdmin(gateConfig) {

    if (typeof ZOHO === "undefined" ||
        !ZOHO.CREATOR ||
        !ZOHO.CREATOR.UTIL ||
        typeof ZOHO.CREATOR.UTIL.getInitParams !== "function") {

        console.error("getInitParams is not available on this SDK build.");
        return Promise.resolve(false);
    }

    let params;

    try {
        params = ZOHO.CREATOR.UTIL.getInitParams();
    }
    catch (error) {
        console.error("getInitParams threw an error:", error);
        return Promise.resolve(false);
    }

    console.log("Creator init params:", params);

    const loginUser = params && params.loginUser
        ? String(params.loginUser).trim().toLowerCase()
        : "";

    const adminEmails = (gateConfig.adminEmails || [])
        .map(function(email) {
            return String(email).trim().toLowerCase();
        });

    const isAdmin = adminEmails.indexOf(loginUser) !== -1;

    console.log("Logged in user:", loginUser);
    console.log("Configured admins:", adminEmails);
    console.log("Is admin:", isAdmin);

    return Promise.resolve(isAdmin);
}
/* =========================================================
   PAST BOOKINGS ENFORCEMENT
========================================================= */

function hasPastBookings(records) {
    return (records || []).some(function(record) {
        return record._bookingGroup === "Past";
    });
}