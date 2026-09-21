/* =========================================================
   BOOKINGS OPERATIONS CONFIGURATION
========================================================= */

const CONFIG = {
/* =========================================================
   BLUEPRINT API
========================================================= */

blueprintApi: {
    apiName: "ExecuteJDBlueprintTransition",
    publicKey: "BR6G6eas0mChymMtq4PEJknmb",
    endpoint:  "https://www.zohoapis.com/creator/custom/taylorsolutions/ExecuteJDBlueprintTransition?publickey=BR6G6eas0mChymMtq4PEJknmb",
    workspaceName: "taylorsolutions",
    idParam: "JobID"  
},
bookingBlueprintApi: {
    apiName: "ExecuteBookingsBpTransition",
    publicKey: "swPEpVatzrvCB5sXXyMm52XJ3",
    workspaceName: "taylorsolutions",
     idParam: "BookingID"
},
    /* =====================================================
       CURRENT ONGOING JOBS
    ===================================================== */

    ongoingJobs: {

        reportName: "All_Jobs",

        criteria: '(Status == "Ongoing")',

        pageSize: 200,

        columns: [

            {
                label: "Job Card No.",
                field: "Job_Card_Number1"
            },

            {
                label: "Client Name",
                field: "Account_Name"
            },

            {
                label: "Move Date",
                field: "Move_Date"
            },

            {
                label: "Duration",
                field: "Quoted_Duration"
            },

            {
                label: "Move Type",
                field: "Move_Type"
            },

            {
                label: "CBM",
                field: "Requested_CBM"
            },

            {
                label: "Job Stage",
                field: "_blueprintStage"
            }

        ]

    },


    /* =====================================================
       BOOKINGS TO CONFIRM
    ===================================================== */

    bookingsToConfirm: {

        reportName: "Bookings_View",
        criteria: '(Status == "Pending")',
        dateField: "Actual_Move_Date",
        pageSize: 200,
        columns: [

            {
                label: "Client Name",
                field: "Account_Name1"
            },
             {
                label: "Contact Name",
                field: "Contact_Name"
            },
            {
                label: "Contact Phone",
                field: "Contact_Phone"
            },
            {
                label: "Booking Date",
                field: "Actual_Move_Date"
            },
            {
                label: "Booking Type",
                field: "Booking_Type"
            },
            {
                label: "Move Type",
                field: "Move_Type"
            },

            {
                label: "CBM",
                field: "CBM1"
            },
             {
                label: "Duration",
                field: "Duration"
            },

            {
                label: "Reservation Note",
                field: "Reservation_Note"
            },
            {
                label: "Origin Area",
                field: "Origin_Area"
            },

            {
                label: "Dest. Area",
                field: "Destination_Area"
            }

        ]

    },
 /* =====================================================
       NOT STARTED JOBS
    ===================================================== */
notStartedJobs: {

    reportName: "Bookings_View",

    criteria: '(Status == "Approved" && Job_Stage == "Not Started")',

    pageSize: 200,

    columns: [

        {
            label: "Job Card No.",
            field: "Job_Card_Number"
        },

        {
            label: "Client Name",
            field: "Account_Name1"
        },

        {
            label: "Move Date",
            field: "Actual_Move_Date"
        },

        {
            label: "Move Type",
            field: "Move_Type"
        },

        {
            label: "CBM",
            field: "CBM1"
        },

        {
            label: "Origin Area",
            field: "Origin_Area"
        },

        {
            label: "Dest. Area",
            field: "Destination_Area"
        }

    ]

},
dispatchedJobs: {
    reportName: "All_Jobs",
    criteria: '(Job_Stage == "Dispatched")',
    pageSize: 200,
    columns: [
        {label:"Job Card No.",field:"Job_Card_Number1"},
        {label:"Client Name",field:"Account_Name"},
        {label:"Move Date",field:"Move_Date"},
        {label:"Duration",field:"Quoted_Duration"},
        {label:"Move Type",field:"Move_Type"},
        {label:"CBM",field:"Requested_CBM"},
        {label:"Job Stage",field:"Job_Stage"}
    ]
},
ongoingJobsGate: {
    enabled: true,
    timezone: "Africa/Nairobi",
    startHour: 16,
    endHour: 8,
    reportName: "All_Jobs",
    criteria: '(Status == "Ongoing")',
    adminEmails: [
        "sales@taylorea.com"
    ]
},
};
