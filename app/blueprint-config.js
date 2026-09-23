const BLUEPRINT_API_MAP = {
    job_stage: "blueprintApi",
    confirm_booking: "bookingBlueprintApi",
    continuation_starting: "bookingBlueprintApi"
};
const LABOUR_CONFIRMATION_DURING_ACTION = {
    type: "updateFields",
    reportName: "Bookings_View",
    formName: "Confirm Labour Allocation",

    fields: [
        {
            field: "Assigned_Labour_Subform",
            label: "Assigned Labour",
            type: "subform",

            columns: [
                {
                    field: "Name",
                    label: "Name",
                    type: "lookup",
                    lookupReport: "All_Team_Members",
                    valueField: "ID",
                    displayField: "Name",
                    searchable: true,
                    criteria: '(Taylor_Active_Status == "Active")'
                },
                {
                    field: "Role",
                    label: "Role",
                    type: "select",
                    options: ["Team Leader", "Assistant TL", "Mover","Driver"]
                }
            ]
        }
    ]
};
const lookup = (field, label, role, layout) => ({
    field, label, type: "lookup", lookupReport: "All_Team_Members", valueField: "ID", displayField: "Name", searchable: true, criteria: `(Role == "${role}")`, ...(layout && { layout })
});

const DISPATCH_CONFIRMATION_DURING_ACTION = {
    type: "updateFields", reportName: "Bookings_View", formName: "Dispatch Confirmation",
    fields: [
        lookup("Dispatcher", "Dispatcher", "Dispatcher", "half"),
        lookup("Driver", "Driver", "Driver", "half"),
        { field: "Abrupt_Move", label: "Is this an abrupt move?", type: "select", options: ["No", "Yes"], defaultValue: "No" },
        { field: "Reason_for_abrupt", label: "Reason for abrupt move", type: "select", options: ["Abrupt due to client issues", "Abrupt due to sales side issues"], 
             requiredWhen:{field:"Abrupt_Move",equals:"Yes"}, showWhen: { field: "Abrupt_Move", equals: "Yes" } },
        {
            field: "Assigned_Labour_Subform", label: "Assigned Labour", type: "subform",
            columns: [
                { field: "Name", label: "Name", type: "lookup", lookupReport: "All_Team_Members", valueField: "ID", displayField: "Name", searchable: true, criteria: '(Taylor_Active_Status == "Active")' },
                { field: "Role", label: "Role", type: "select", options: ["Team Leader", "Assistant TL", "Mover","Driver"] }
            ]
        }
    ],
    rules:{
    addLookupToSubform:{sourceField:"Driver",targetSubform:"Assigned_Labour_Subform",
        valueColumn:"Name",
        extraValues:{Role:"Driver"}
    }
}
};
const BLUEPRINT_CONFIG = {

    job_stage: {
         commonTransitions: [

        {label: "Cancelled",linkName: "Cancelled"},
       
    ],
        Dispatched: [

    {
        label: "Confirm Started",
        linkName: "Confirm_Started",

        duringAction: {
            type: "updateFields",
            formName: "Job Details",
            reportName: "All_Jobs",

            fields: [

                {
                    field: "Move_Start_Date",
                    label: "Move Start Date",
                    type: "date"
                },

                {
                    field: "Client_Available_at_orign_and_destination1",
                    label: "Client Available at Origin and Destination",
                    type: "select",
                    options: [
                        "Yes",
                        "No"
                    ]
                },

                {
                    field: "Has_client_signed_relocation_agreement1",
                    label: "Has Client Signed Relocation Agreement",
                    type: "select",
                    options: [
                        "Yes",
                        "No"
                    ]
                },

                {
                    field: "Does_extra_services_quoted_match_the_actual_needed1",
                    label: "Do Extra Services Quoted Match the Actual Needed",
                    type: "select",
                    options: [
                        "Yes",
                        "No"
                    ]
                },

                {
                    field: "Do_you_have_enough_material_for_the_job1",
                    label: "Do You Have Enough Material for the Job",
                    type: "select",
                    options: [
                        "Yes",
                        "No"
                    ]
                },

                {
                    field: "Do_you_have_enough_labor_for_the_job1",
                    label: "Do You Have Enough Labor for the Job",
                    type: "select",
                    options: [
                        "Yes",
                        "No"
                    ]
                },

                {
                    field: "Shall_the_job_be_completed_the_same_day1",
                    label: "Shall the Job Be Completed the Same Day",
                    type: "select",
                    options: [
                        "Yes",
                        "No"
                    ]
                },

                {
                    field: "Any_other_challenges",
                    label: "Any Other Challenges",
                    type: "text"
                }

            ]
        }
    }

],
    "Long Distance Continuing": [
            {label: "Confirm Started", linkName: "Started2" }
        ],
        Ongoing: [

            {
                label: "Mark Move done",
                linkName: "Mark_Move_done",

                duringAction: {
                    type: "updateFields",
                    formName: "paymentConfirmation",

                    fields: [

                        {
                            field: "Final_Payment_Received",
                            label: "Final Payment Received",
                            type: "select",
                            options: [
                                "Yes",
                                "No",
                                "N/A"
                            ],
                            required: true
                        },

                        {
                            field: "Amount_Paid",
                            label: "Amount Paid",
                            type: "number",

                            requiredWhen: {
                                field: "Final_Payment_Received",
                                equals: "Yes"
                            }
                        },

                        {
                            field: "Mode_of_payment",
                            label: "Mode of Payment",
                            type: "select",

                            options: [
                                "MPESA",
                                "Cash",
                                "Cheque"
                            ],

                            requiredWhen: {
                                field: "Final_Payment_Received",
                                equals: "Yes"
                            }
                        }

                    ]
                }
            },

            {
                label: "Continuing",
                linkName: "Continuing_Group",
                type: "choice",

                choices: [

                    {
                        label: "Continuing Tomorrow",
                        linkName: "Continuing_Tomorrow",
                        afterAction: "openPrepSheetForNewRecord",
                        lookupReport: "All_Jobs",
                        lookupField: "Latest_Continuing_Booking_ID"
                    },

                    {
                        label: "Continuing on a Specific Day",
                        linkName: "Continuing_on_a_specific_",

                        duringAction: {
                            type: "updateFields",
                            reportName: "All_Jobs",
                            formName: "Continuation Details",

                            fields: [

                                {
                                    field: "Continuing_Date1",
                                    label: "Continuing Date",
                                    type: "datetime",
                                    required: true
                                }

                            ]
                        }
                    },

                    {
                        label: "Spill Over",
                        linkName: "Spill_Over",
                        afterAction: "openPrepSheetForNewRecord",
                        lookupReport: "All_Jobs",
                        lookupField: "Latest_Continuing_Booking_ID"
                    },
                    {
                        label: "Long Distance Continuing",
                        linkName: "Confirm_Long_Distance_Con"
                    },
                    {
                        label: "Unsure about completion",
                        linkName: "Unsure_About_Completion"
                    }

                ]
            },
        ],
        Continuing: [
        { label: "Ongoing", linkName: "Started2" }
    ],

    "Spill Over": [
        { label: "Ongoing", linkName: "Started2" }
    ],

    "International in Transit": [
        { label: "Ongoing", linkName: "Started2" }
    ],
    "Updated to Unsure": [
        { label: "Update", linkName: "Started2" }
    ],

    },
    confirm_booking: {

    Pending: [

       /* {
            label: "Approve Booking",
            linkName: "Approve",
            afterAction: "openPrepSheet"
        },*/
        {
            label: "Approve Booking",   
            linkName: "New_Approval_Planningg",
            afterAction: "openPlanning"
        },

        {
            label: "Cancelled",
            linkName: "Cancelled"
        },

        {
            label: "Postponed",
            linkName: "Postponed",

            duringAction: {
                type: "updateFields",
                reportName: "Bookings_View",
                formName: "Postpone Booking",

                fields: [

                    {
                        field: "New_Booking_Date",
                        label: "New Booking Date",
                        type: "datetime",
                        required: true
                    }

                ]
            }
        }

    ],
    Approved: [

        {
            label: "Dispatched",
            linkName: "Dispatched",
            duringAction: DISPATCH_CONFIRMATION_DURING_ACTION
        },

        {
            label: "Cancelled",
            linkName: "Cancelled"
        },

        {
            label: "Postponed",
            linkName: "Postponed",

            duringAction: {
                type: "updateFields",
                reportName: "Bookings_View",
                formName: "Postpone Booking",

                fields: [
                    {
                        field: "New_Booking_Date",
                        label: "New Booking Date",
                        type: "datetime",
                        required: true
                    }
                ]
                
            }
        }

    ]



},
continuation_starting: {

    Approved: [

        {
            label: "Dispatched",
            linkName: "Continuation_Started",
            duringAction: DISPATCH_CONFIRMATION_DURING_ACTION
        },

        {
            label: "Cancelled",
            linkName: "Cancelled"
        },

        {
            label: "Postponed",
            linkName: "Postponed",

            duringAction: {
                type: "updateFields",
                reportName: "Bookings_View",
                formName: "Postpone Booking",

                fields: [

                    {
                        field: "New_Booking_Date",
                        label: "New Booking Date",
                        type: "datetime",
                        required: true
                    }

                ]
            }
        }

    ]

}
};